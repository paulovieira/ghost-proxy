// note that the a route configuration with the directory handler is only possible after
// the inert plugin has been registered

var internals = {};

internals.config = {};

internals.config.ghostProxyStatic = {
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
    cors: {
        methods: ["GET"]
    },

    auth: false,

    // if there is no auth, there's no need to parse cookies
    state: {
        parse: false
    },
    
};

// internals.config.ghostAssets = {
//     handler: {
//         directory: { 
//             path: __dirname + "/assets",
//             index: false,
//             listing: false,
//             showHidden: false
//         }
//     },
//     cache: {
//         privacy: "public",
//         expiresIn: 3600000
//     },
//     cors: {
//         methods: ["GET"]
//     },

//     auth: false,

//     // if there is no auth, there's no need to parse cookies
//     state: {
//         parse: false
//     },
    
// };

exports.register = function(server, options, next){

    // route for the client libraries (static files like css, js, etc); relative to the ghost-proxy plugin
    server.route({
        path: "/static/{anyPath*}",
        method: "GET",
        config: internals.config.ghostProxyStatic
    });

    // route for the client libraries (static files like css, js, etc); relative to the ghost app
    // server.route({
    //     path: "/assets/{anyPath*}",
    //     method: "GET",
    //     config: internals.config.ghostAssets
    // });

    return next();
};

exports.register.attributes = {
    name: "routes-static",
    dependencies: ["inert"]
};
