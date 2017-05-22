var internals = {};


exports.register = function(server, options, next){

    server.route({
        path: "/login",
        method: "GET",
        config: {
            handler: function(request, reply) {
                
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
                strategy: "cookie-cache",
                mode: "try"
            },

            /*
            plugins: {

                // disable the redirectTo option for this route (given to the hapi auth cookie), otherwise
                // we get and infinite redirect loop
                "hapi-auth-cookie": {
                    redirectTo: false
                }
            }
            */
        }
    });

    return next();
};

exports.register.attributes = {
    name: "routes-login",
    dependencies: ["hapi-auth-cookie-cache"]
};
