require('./config/load');
var Config = require('nconf');

var Glue = require("glue");
var Hoek = require("hoek");
var Boom = require("boom");
var Nunjucks = require("nunjucks");

const DATA_NOT_SUBMITTED = 1;
const UNKNOWN_USERNAME = 2;
const WRONG_PASSWORD = 3;
const EXPIRED = 4;

var internals = {};

internals["3 hours"]    = 3 * 60 * 60 * 1000;
internals["20 seconds"] =          20 * 1000;
internals["10 seconds"] =          10 * 1000;
internals["5 seconds"]  =           5 * 1000;

internals.users = [
    {
        username: Config.get("username"),
        password: Config.get("password"),
    }
];

console.log(internals.users)

internals.configureNunjucks = function(server){

    server.views({
        path: __dirname + "/views",
        allowAbsolutePaths: true,
        engines: {

            html: {
                compile: function (src, options) {

                    var template = Nunjucks.compile(src, options.environment);

                    return function (context) {

                        return template.render(context);
                    };
                },

                prepare: function (options, next) {

                    options.compileOptions.environment = Nunjucks.configure(options.path, { 
                        autoescape: false,
                        watch: false, 
                        trimBlocks: true,
                    });

                    return next();
                }
            }
        },

    });
};

var manifest = {
    server: {

        cache: [
            {
                name: 'my-memory-cache',
                engine: require('catbox-memory')
            },
        ],

        //  default connections configuration
        connections: {

            // controls how incoming request URIs are matched against the routing table
            router: {
                isCaseSensitive: false,
                stripTrailingSlash: true
            },

            // default configuration for every route.
            routes: {
                state: {
                    // determines how to handle cookie parsing errors ("ignore" = take no action)
                    failAction: "ignore"
                },

                // disable node socket timeouts (useful for debugging)
                timeout: {
                    server: false,
                    socket: false
                }
            }
        },

    },

    connections: [
        {
            host: Config.get("proxy:host"),
            port: Config.get("proxy:port")
        }
    ],

    registrations: [
        {
            plugin: {
                register: 'blipp',
                options: {
                    showAuth: true
                }
            },
            options: {}
        },
        {
            plugin: {
                register: 'h2o2',
                options: {}
            },
            options: {}
        },
        {
            plugin: {
                register: 'vision',
                options: {}
            },
            options: {}
        },
        {
            plugin: {
                register: 'hapi-auth-cookie',
                options: {}
            },
            options: {}
        },
        {
            plugin: {
                register: 'inert',
                options: {}
            },
            options: {}
        },
        {
            plugin: {
                register: './routes-static',
                options: {}
            },
            options: {}
        },
        
        {
            plugin: {
                register: "hapi-auth-cookie-cache",
                options: {

                    // options for the cache policy

                    policy: {
                        cache: 'my-memory-cache',
                        segment: 'sessions',
                        expiresIn: 9999999
                    },

                    // options for the cookie scheme (implemented by hapi-auth-cookie)

                    strategyName: 'cookie-cache',
                    scheme: {

                        password: 'something-very-random-and-must-have-at-least-32-chars',
                        isSecure: false,

                        // erase the cookie if the cached data has expired (or some other error has happened)
                        clearInvalid: true,

                        // if auth mode is 'try' and if the validation fails (no cookie, for instance), will send a 
                        // 302 response using reply.redirect(); the url should be given in the route configuration, 
                        // at 'plugins.["hapi-auth-cookie"].redirectTo'; 
                        // if 'redirectTo' is missing, it has no effect (that is, hapi will reply normally, as if the 
                        // route had auth === false);

                        // note: if strategy mode is 'optional', it works the same way (but it seems to be a bug in hapi-auth-cookie)
                        redirectOnTry: false,

                        // important: do not set redirectTo here, use instead the route level configuration at
                        // config.plugins.["hapi-auth-cookie"].redirectTo
                        //redirectTo: '',

                        //appendNext: true,

                        // use a long ttl for the cookie; the cookie will actually be cleared when the 
                        // client data in the cache has expired, so the option that actually matter is policy.expiresIn;
                        // note that in this case (when the cached data has expired) the clearing of the cookie
                        // happens in hapi-auth-cookie, at the callback given to 'validateFunc'; the cookie will
                        // be cleared for for 2 reasons: 
                        //  a) we are calling calling the callback with false in the 2nd arg ('isValid')
                        //  b) the clearInvalid option is true
                        ttl: internals['1 year']
                    },

                    // url to send the login data (usually username + password); the plugin will create a POST route;
                    // the page containing the form to submit the credentials must be implemented by the application;
                    // the logic to validate the data must be implemented in the 'validateLoginData' callback (which
                    // includes the url to direct to after the validation)
                    loginDataPath: '/login-data',

                    // url to logout the user; the plugin will create a GET route; the handler will execute the tasks
                    // that correspond to a logout - clear the plugin cookie, clear the session in the cache; 
                    // the response will be a redirection to the url given in logoutRedirectTo
                    logoutPath: '/logout',

                    // url to redirect to after the logout tasks are executed; can be overriden using a query string with 
                    // the same key;
                    logoutRedirectTo: '/',
                    /*
                    logoutRedirectTo: function (request, reply) {

                        console.log('logging out: ', request.auth.credentials);
                        return reply('You are being redirected...').redirect('/login');
                    },
                    */
                
                    validateLoginData: function (request, next){

                        const submittedUsername = request.payload.username;
                        const submittedPassword = request.payload.password;

                        // try to find the user in the database
                        const dbUser = internals.users.find(obj => obj.username === submittedUsername);

                        let failReason = 0;

                        // Possible reasons for authentication to fail:
                        //   - missing username or password
                        //   - username does not exist in the database
                        //   - wrong password (username exists but password doesn't match)

                        if (!submittedUsername || !submittedPassword) {
                            failReason = DATA_NOT_SUBMITTED;
                        }
                        else if (dbUser === undefined){
                            failReason = UNKNOWN_USERNAME;
                        }
                        else if (dbUser.password !== submittedPassword){
                            failReason = WRONG_PASSWORD;
                        }

                        let isValid, sessionData, redirectTo;

                        if (failReason > 0){
                            isValid = false;
                            sessionData = null;
                            redirectTo = `/login?auth-fail-reason=${ failReason }`;
                        }
                        else {
                            // username/password are valid; define the session object to be stored
                            // in the cache (using the catbox policy created internally by the plugin)

                            isValid = true;
                            sessionData = {
                                username: dbUser.username
                            };
                            redirectTo = '/';
                        }

                        return next(null, isValid, sessionData, redirectTo);
                    }
                }
            },
            options: {}
        },
        {
            plugin: {
                register: './routes-login',
                options: {}
            },
            options: {}
        },
        {
            plugin: {
                register: './routes-proxy',
                options: {}
            },
            options: {}
        },        
        /*
*/
/*

xxx
        {
            "blipp": {
                showAuth: true
            }
        },

        {
            "h2o2": {

            }
        },

        {
            "vision": {

            }
        },

        {
            "hapi-auth-cookie": {

            }
        },

        {
            "inert": {

            }
        },

        // dependencies: ["inert"]
        {
            "./routes-static": {

            }
        },

        // dependencies: ["hapi-auth-cookie"]
        {
            "hapi-auth-session-memory": {
                loginPath: "/login",
                logoutPath: "/exit",
                successRedirectTo: "/",
                validateLoginData: function(request, next){
debugger;
                    var authFailed;
                    var user = request.payload.user, password = request.payload.password;

                    //    Possible reasons for a failed authentication
                    //     - "missing username or password" (won't even connect to the DB)
                    //     - "username does not exist" 
                    //     - "wrong password" (username exists but password doesn't match)
                    
                    if (!user || !password) {
                        authFailed = "missing";
                    }
                    else if(user.toLowerCase() !== internals.validUser.toLowerCase()){
                        authFailed = "unknown-user";
                    }
                    else if(password.toLowerCase() !== internals.validPassword.toLowerCase()){
                        authFailed = "wrong-password";
                    }

                    if(authFailed){
                        return next(Boom.unauthorized("/login?auth-fail-reason=" + authFailed));
                    }

                    // if we arrive here, the username and password match
                    var loginData = {
                        user: user
                    };

                    return next(undefined, loginData);
                },

                // strategy options - see hapi-auth-cookie and the options to server.auth.strategy
                // in the main docs; if some option is not given, the defaults will be used
                ironPassword: Config.get("ironPassword"),
                isSecure: false,
                clearInvalid: true,
                appendNext: true,
                redirectOnTry: true,
                //ttl: internals["3 hours"],
            }
        },

        // dependencies: ["hapi-auth-session-memory"]
        {
            "./routes-login": {

            }
        },

        // dependencies: ["h2o2", "hapi-auth-session-memory"]
        {
            "./routes-proxy": {

            }
        },
*/

    ]
};

var options = {
    relativeTo: __dirname,
};

Glue.compose(manifest, options, function (err, server) {

    Hoek.assert(!err, "Failed registration of one or more plugins: " + err);

    internals.configureNunjucks(server);

    // start the server and finish the initialization process
    server.start(function(err) {

        Hoek.assert(!err, "Failed start server: " + err);

        console.log("Server started at: " + server.info.uri);
        console.log("Hello world! This is hapi " + server.version);
    });
});
