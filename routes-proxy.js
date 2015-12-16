var Config = require("config");

var internals = {};
internals.baseUri = "http://" + Config.get("ghost.host") + ":" + Config.get("ghost.port");

internals.abortIfNotAuthenticated = function(request, reply){
debugger;
    //request.auth.isAuthenticated = true;
    if(!request.auth.isAuthenticated) {
        return reply()
                .redirect("/login")
                .takeover();
    }

    return reply();
};

internals.config = {};

internals.config.proxy = {

    handler: {
        proxy: {
            mapUri: function(request, cb){

                return cb(null, internals.baseUri + request.raw.req.url);
            },

            redirects: 10, 
            passThrough: true,
            //ttl: "upstream"
        }                
    },

    payload: {
        maxBytes: 4*1048576  // 4 MB
    },

    auth: {
        strategy: "session-memory",
        mode: "try"
    },

    pre: [internals.abortIfNotAuthenticated]

};

exports.register = function(server, options, next){

    server.route({
        method: "*",
        path:"/{any*}", 
        config: internals.config.proxy
    });

    return next();
};

exports.register.attributes = {
    name: "routes-proxy",
    dependencies: ["h2o2", "hapi-auth-session-memory"]
};


