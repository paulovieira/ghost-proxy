
var internals = {};

exports.register = function(server, options, next){

    // route for the client libraries (static files like css, js, etc); relative to the ghost-proxy plugin
    server.route({
        path: "/static/{anyPath*}",
        method: "GET",
        config: {

            handler: {
                directory: { 
                    path: __dirname + "/static",
                    index: false,
                    listing: false,
                    showHidden: false
                }
            },

            cache: {
                privacy: "public",
                expiresIn: 3600000
            },
            /*
            cors: {
                methods: ["GET"]
            },
            */

            auth: false,

            // if there is no auth, there's no need to parse cookies
            state: {
                parse: false
            },
            
        }
    });


    return next();
};

exports.register.attributes = {
    name: "routes-static",
    dependencies: ["inert"]
};
