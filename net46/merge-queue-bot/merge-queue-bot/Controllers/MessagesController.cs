using System;
using System.Net;
using System.Net.Http;
using System.Threading.Tasks;
using System.Web.Http;
using AenSidhe.MergeQueueBot.Dialogs;
using AenSidhe.MergeQueueBot.Repositories;
using Microsoft.Bot.Builder.Dialogs;
using Microsoft.Bot.Connector;

namespace AenSidhe.MergeQueueBot.Controllers
{
    [BotAuthentication]
    public class MessagesController : ApiController
    {
        private readonly IQueryableRepository<User> _userQueryRepository;
        private readonly IUpdatableRepository<User> _userUpdateRepository;

        public MessagesController(IQueryableRepository<User> userQueryRepository, IUpdatableRepository<User> userUpdateRepository)
        {
            _userQueryRepository = userQueryRepository;
            _userUpdateRepository = userUpdateRepository;
        }

        /// <summary>
        /// POST: api/Messages
        /// Receive a message from a user and reply to it
        /// </summary>
        public async Task<HttpResponseMessage> Post([FromBody]Activity activity)
        {
            if (activity.Type == ActivityTypes.Message)
            {
                var currentUser = GetOrCreateUserAsync(activity.From);
                await Conversation.SendAsync(activity, () => new RootDialog());
            }
            else
            {
                HandleSystemMessage(activity);
            }
            return Request.CreateResponse(HttpStatusCode.OK);
        }

        private async Task<User> GetOrCreateUserAsync(ChannelAccount activityFrom)
        {
            var user = await _userQueryRepository.Get(new SelectUserByExternalIdQuery(activityFrom.Id));
            if (user != null)
                return user;

            return await _userUpdateRepository.Update(new CreateUserQuery(activityFrom.Name, activityFrom.Id));
        }

        private Activity HandleSystemMessage(Activity message)
        {
            if (message.Type == ActivityTypes.DeleteUserData)
            {
                // Implement user deletion here
                // If we handle user deletion, return a real message
            }
            else if (message.Type == ActivityTypes.ConversationUpdate)
            {
                // Handle conversation state changes, like members being added and removed
                // Use Activity.MembersAdded and Activity.MembersRemoved and Activity.Action for info
                // Not available in all channels
            }
            else if (message.Type == ActivityTypes.ContactRelationUpdate)
            {
                // Handle add/remove from contact lists
                // Activity.From + Activity.Action represent what happened
            }
            else if (message.Type == ActivityTypes.Typing)
            {
                // Handle knowing tha the user is typing
            }
            else if (message.Type == ActivityTypes.Ping)
            {
            }

            return null;
        }
    }
}