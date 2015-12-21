var UUID = require("node-uuid");
var Config = require("config");

var internals = {};

internals["3 hours"]    = 3 * 60 * 60 * 1000;
internals["30 seconds"] =          30 * 1000;
internals["20 seconds"] =          20 * 1000;
internals["10 seconds"] =          10 * 1000;

internals.ttl = internals["3 hours"];

exports.register = function(server, options, next){

    // TODO: validate the options with Joi
    // TODO: verify if there are any other options to the strategy

    // create the memory cache
    server.app.sessionCache = server.cache({
        segment: "sessionSegment"
    });

    // registers an authentication strategy named "session" using the "cookie" scheme
    // (the scheme should have been previously registered in the hapi-auth-cookie plugin)
    options.cookieName = options.cookieName || "sid";
    server.auth.strategy("session-memory", "cookie", false, {
        password: options.ironPassword,
        cookie: options.cookieName,
        ttl: options.ttl || internals.ttl,
        isSecure: options.isSecure || false,
        clearInvalid: options.clearInvalid || true, // if the session is expired, will delete the cookie in the browser (but if the cookie has expired, it will remain)

        redirectTo: options.redirectTo || options.loginPath,  // if authentication fails, redirect; if not set, will simply return a forbidden message
        appendNext: options.appendNext || true,
        redirectOnTry: options.redirectOnTry || true,

        validateFunc: function(request, session, callback) {
            debugger;

            // note: session[options.cookieName] is the uuid previously used in sessionCache.set
            request.server.app.sessionCache.get(session[options.cookieName], function(err, value, cached, report) {
                debugger;

                if (err) {
                    // could not get session data from catbox
                    return callback(err);
                }

                if (!cached) {
                    // session data in catbox is invalid
                    return callback(null, false);
                }

                return callback(null, true, value);
            });

            console.log(request.server.app.sessionCache.stats);

        },
    });

    // login route
    server.route({
        path: options.loginPath,
        method: "POST",
        config: {

            handler: function(request, reply) {
                debugger;

                if (request.auth.isAuthenticated) {
                    return reply.redirect(options.successRedirectTo);
                }

                // TODO: the logic to check the password should be extracted
                options.validateLoginData(request, function(err, loginData){

                    if(err){
                        if(err.output && err.output.statusCode === 401){
                            // the meaning of output.message is overloaded here
                            return reply.redirect(err.message);
                        }

                        return reply(err);
                    }

                    // we now set the session in the internal cache (Catbox with memory adapter)
                    var newSession = {
                        uuid: UUID.v4(),
                        loginData: loginData
                    };

                    // store an item in the cache
                    request.server.app.sessionCache.set(

                        // the unique item identifier 
                        newSession.uuid,

                        //  value to be stored
                        newSession,

                        // same value as the ttl in the cookie
                        internals.ttl, 

                        function(err) {
                            debugger;

                            if (err) {
                                return reply(err);
                            }

                            var cookieCrumb = {};
                            cookieCrumb[options.cookieName] = newSession.uuid;

                            request.auth.session.set(cookieCrumb);
                            
                            return reply.redirect(options.successRedirectTo);
                        }
                    );

                });




/*
                var authFailed;
                var user = request.payload.user, password = request.payload.password;

                //    Possible reasons for a failed authentication
                //     - "missing username or password" (won't even connect to the DB)
                //     - "username does not exist" 
                //     - "wrong password" (username exists but password doesn't match)
                
                if (!user || !password) {
                    authFailed = "missing";
                }
                else if(user.toLowerCase() !== internals.user.toLowerCase()){
                    authFailed = "unknown-user";
                }
                else if(password.toLowerCase() !== internals.password.toLowerCase()){
                    authFailed = "wrong-password";
                }

                if(authFailed){
                    return reply.redirect(options.loginPath + "?auth-fail-reason=" + authFailed);
                }
                
                // if we arrive here, the username and password match

                // we now set the session in the internal cache (Catbox with memory adapter)
                var newSession = {
                    uuid: UUID.v4(),
                    user: user
                };

                // store an item in the cache
                request.server.app.sessionCache.set(

                    // the unique item identifier 
                    newSession.uuid,

                    //  value to be stored
                    newSession,

                    // same value as the ttl in the cookie
                    internals.ttl, 

                    function(err) {
                        debugger;

                        if (err) {
                            return reply(err);
                        }

                        var cookieCrumb = {};
                        cookieCrumb[options.cookieName] = newSession.uuid;

                        request.auth.session.set(cookieCrumb);
                        
                        return reply.redirect(options.successRedirectTo);
                    }
                );
*/
            },

            auth: {
                strategy: "session-memory",
                mode: "try"
            },

            plugins: {

                "hapi-auth-cookie": {
                    redirectTo: false
                }
            }

        }
    });

    // logout route
    server.route({
        path: options.logoutPath,
        method: "GET",
        config: {

            handler: function(request, reply) {
debugger;
                if(!request.auth.isAuthenticated){
                    return reply.redirect(options.loginPath);
                }

                var uuid;
                if(request.auth.artifacts){

                    uuid = request.auth.artifacts[options.cookieName];
                }

                request.server.app.sessionCache.drop(uuid, function(err){
debugger;
                    if(err){
                        return reply(err);
                    }

                    request.auth.session.clear();
                    return reply.redirect(options.loginPath);
                });
            },

            auth: {
                strategy: "session-memory",
                mode: "try"
            },

            plugins: {

                "hapi-auth-cookie": {
                    redirectTo: false
                }
            }
        }
    });

    return next();

};

exports.register.attributes = {
    name: "hapi-auth-session-memory",
    dependencies: ["hapi-auth-cookie"]
};
