var internals = {};

internals.routeConfig = {};

internals.routeConfig.login = {

    handler: function(request, reply) {
        debugger;
        
        //request.auth.isAuthenticated = true;
        if (request.auth.isAuthenticated) {
            return reply.redirect("/");
        }

        var ctx = {
            query: request.query
        };

        return reply.view("login", {
            ctx: ctx
        });
    },

    auth: {
        strategy: "session-memory",
        mode: "try"
    },

    plugins: {

        // disable the redirectTo option for this route (given to the hapi auth cookie), otherwise
        // we get and infinite redirect loop
        "hapi-auth-cookie": {
            redirectTo: false
        }
    }

};


exports.register = function(server, options, next){

    server.route({
        path: "/login",
        method: "GET",
        config: internals.routeConfig.login
    });

    return next();
};

exports.register.attributes = {
    name: "routes-login",
    dependencies: ["hapi-auth-session-memory"]
};
