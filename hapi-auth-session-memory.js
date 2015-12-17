var UUID = require("node-uuid");
var Config = require("config");

var internals = {};

// TODO: optins should be given to the plugin, not read directly b the plugin
internals.ironPassword = Config.get("ironPassword");
internals.user = Config.get("user");
internals.password = Config.get("password");
internals.cookieName = "sid";

internals["3 hours"]    = 3 * 60 * 60 * 1000;
internals["30 seconds"] =          30 * 1000;
internals["20 seconds"] =          20 * 1000;
internals["10 seconds"] =          10 * 1000;

internals.ttl = internals["3 hours"];

internals.validateFunc = function(request, session, callback) {
    debugger;

    // note: session[internals.cookieName] is the uuid previously used in sessionCache.set
    request.server.app.sessionCache.get(session[internals.cookieName], function(err, value, cached, report) {
        debugger;

        if (err) {
            //internals.server.log(["auth"], "validateFunc: could not get session data from catbox - authentication failed!");
            return callback(err);
        }

        if (!cached) {
            //internals.server.log(["auth"], "validateFunc: session data in catbox is invalid - authentication failed!");
            return callback(null, false);
        }

        return callback(null, true, value);
    });

    console.log(request.server.app.sessionCache.stats);

},
internals.routeConfig = {};

internals.routeConfig.login = {

    handler: function(request, reply) {
        debugger;

        if (request.auth.isAuthenticated) {
            return reply.redirect("/");
        }

        // TODO: the logic to check the password should be extracted

        var authFailed;
        var user = request.payload.user, password = request.payload.password;

        //    Possible reasons for a failed authentication
        //     - "missing username or password" (won't even connect to the DB)
        //     - "username does not exist" 
        //     - "wrong password" (username exists but password doesn't match)
        
        if (!user || !password) {
            authFailed = "missing";
        }
        else if(user !== internals.user.toLowerCase()){
            authFailed = "unknown-user";
        }
        else if(password !== internals.password.toLowerCase()){
            authFailed = "wrong-password";
        }

        if(authFailed){
            return reply.redirect("/login?auth-fail-reason=" + authFailed);
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

                var cookieCrumb = {}
                cookieCrumb[internals.cookieName] = newSession.uuid;

                request.auth.session.set(cookieCrumb);
                
                return reply.redirect("/");
            }
        );

    },

    auth: {
        strategy: "session-memory",
        mode: "try"
    },

};


internals.routeConfig.logout = {

    handler: function(request, reply) {

        if(!request.auth.isAuthenticated){
            return reply.redirect("/login");
        }

        var uuid;
        if(request.auth.artifacts){

            uuid = request.auth.artifacts[internals.cookieName];
        }

        request.server.app.sessionCache.drop(uuid, function(err){

            if(err){
                return reply(err);
            }

            request.auth.session.clear();
            return reply.redirect("/login");
        });
    },

    auth: {
        strategy: "session-memory",
        mode: "try"
    },
};



exports.register = function(server, options, next){

    // create the memory cache
    server.app.sessionCache = server.cache({
        segment: "sessionSegment"
    });

    // registers an authentication strategy named "session" using the "cookie" scheme
    // (the scheme should have been previously registered in the hapi-auth-cookie plugin)
    server.auth.strategy("session-memory", "cookie", false, {
        password: internals.ironPassword,
        cookie: internals.cookieName,
        ttl: internals.ttl,
        isSecure: false,
        clearInvalid: true, // if the session is expired, will delete the cookie in the browser (but if the cookie has expired, it will remain)

        validateFunc: internals.validateFunc,
        //redirectTo: '/login',  // if authentication fails, redirect; if not set, will simply return a forbidden message
        // redirectOnTry: false,
    });

    server.route({
        path: "/login",
        method: "POST",
        config: internals.routeConfig.login
    });

    server.route({
        //path: "/logout",
        path: "/exit",
        method: "GET",
        config: internals.routeConfig.logout
    });

    return next();

};

exports.register.attributes = {
    name: "hapi-auth-session-memory",
    dependencies: ["hapi-auth-cookie"]
};
