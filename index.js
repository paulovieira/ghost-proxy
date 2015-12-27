var Glue = require("glue");
var Hoek = require("hoek");
var Config = require("config");
var Boom = require("boom");
var Nunjucks = require("nunjucks");

var internals = {};
internals.validUser = Config.get("user");
internals.validPassword = Config.get("password");

internals["3 hours"]    = 3 * 60 * 60 * 1000;
internals["20 seconds"] =          20 * 1000;
internals["10 seconds"] =          10 * 1000;
internals["5 seconds"]  =           5 * 1000;


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
            host: Config.get("proxy.host"),
            port: Config.get("proxy.port")
        }
    ],

    plugins: [
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
            "./hapi-auth-session-memory": {
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


    ]
};

var options = {
    relativeTo: __dirname,
    prePlugins: function(server, next){

        next();
    }
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
