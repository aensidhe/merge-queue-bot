using System.Diagnostics;
using System.Reflection;
using System.Web.Http;
using System.Web.Http.ExceptionHandling;
using AenSidhe.MergeQueueBot.Repositories;
using Autofac;
using Autofac.Core;
using Autofac.Integration.WebApi;
using Newtonsoft.Json;
using Newtonsoft.Json.Serialization;
using ProGaudi.MsgPack.Light;
using ProGaudi.Tarantool.Client;
using ProGaudi.Tarantool.Client.Model;

namespace AenSidhe.MergeQueueBot
{
    public static class WebApiConfig
    {
        public static void Register(HttpConfiguration config)
        {
            // Json settings
            config.Formatters.JsonFormatter.SerializerSettings.NullValueHandling = NullValueHandling.Ignore;
            config.Formatters.JsonFormatter.SerializerSettings.ContractResolver = new CamelCasePropertyNamesContractResolver();
            config.Formatters.JsonFormatter.SerializerSettings.Formatting = Formatting.Indented;
            JsonConvert.DefaultSettings = () => new JsonSerializerSettings
            {
                ContractResolver = new CamelCasePropertyNamesContractResolver(),
                Formatting = Formatting.Indented,
                NullValueHandling = NullValueHandling.Ignore
            };

            // Web API configuration and services

            // Web API routes
            config.MapHttpAttributeRoutes();

            config.Routes.MapHttpRoute(
                "DefaultApi",
                "api/{controller}/{id}",
                new { id = RouteParameter.Optional }
            );

            var builder = new ContainerBuilder();

            // Register your Web API controllers.
            builder.RegisterApiControllers(Assembly.GetExecutingAssembly());

            // OPTIONAL: Register the Autofac filter provider.
            builder.RegisterWebApiFilterProvider(config);

            builder.RegisterMsgPack();
            builder.Register(x => new ClientOptions("operator:operator@localhost:33010", context: x.Resolve<MsgPackContext>())).SingleInstance();
            builder.Register<ILog>(x => null).SingleInstance();
            builder.RegisterBox();

            builder.RegisterAssemblyTypes(typeof(WebApiApplication).Assembly)
                .InNamespace(typeof(UserRepository).Namespace)
                .AsImplementedInterfaces();

            builder.RegisterType<TraceExceptionLogger>().As<IExceptionLogger>().SingleInstance();

            // Set the dependency resolver to be Autofac.
            var container = builder.Build();
            config.DependencyResolver = new AutofacWebApiDependencyResolver(container);
        }
    }

    public class TraceExceptionLogger : ExceptionLogger
    {
        public override void Log(ExceptionLoggerContext context)
        {
            Trace.TraceError(context.ExceptionContext.Exception.ToString());
        }
    }

    public static class MsgPackExtensions
    {
        public static void RegisterMsgPack(this ContainerBuilder builder)
        {
            var msgPackContext = new MsgPackContext();
            msgPackContext.DiscoverConverters<WebApiApplication>();
            builder.Register(x => msgPackContext).SingleInstance();
        }
    }

    public static class TarantoolExtensions
    {
        public static void RegisterBox(this ContainerBuilder builder)
        {
            void Handler(IActivatedEventArgs<Box> args) => args.Instance.Connect().GetAwaiter().GetResult();

            builder.RegisterType<Box>()
                .As<IBox>()
                .SingleInstance()
                .OnActivated(Handler);
        }
    }
}
