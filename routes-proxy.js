var Config = require("nconf");

var internals = {};
internals.baseUri = "http://" + Config.get("ghost:host") + ":" + Config.get("ghost:port");


exports.register = function(server, options, next){

    server.route({
        method: "*",
        path:"/{any*}", 
        config: {

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

            ext: {
                onPostAuth: {
                    method: function(request, reply){

                        if (!request.auth.isAuthenticated) {
                            return reply.redirect('/login');
                        }

                        return reply.continue();
                    }
                }
            },

            payload: {
                maxBytes: 4*1048576  // 4 MB
            },

            auth: {
                strategy: "cookie-cache",
                mode: "try"
            }
        }
    });

    server.route({
        method: "GET",
        path:"/assets/{any*}", 
        config: {

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

            auth: false
        }
    });

    return next();
};

exports.register.attributes = {
    name: "routes-proxy",
    dependencies: ["h2o2", "hapi-auth-cookie-cache"]
};


