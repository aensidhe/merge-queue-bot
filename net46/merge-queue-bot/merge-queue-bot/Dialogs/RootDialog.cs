using System;
using System.Threading.Tasks;
using Microsoft.Bot.Builder.Dialogs;
using Microsoft.Bot.Connector;

namespace AenSidhe.MergeQueueBot.Dialogs
{
    [Serializable]
    public class RootDialog : IDialog<object>
    {
        public Task StartAsync(IDialogContext context)
        {
            // return our reply to the user
            context.Wait(ChooseDialog);

            return Task.CompletedTask;
        }

        Task ChooseDialog(IDialogContext ctx, IAwaitable<IMessageActivity> resume)
        {
            if (ctx.Activity.ChannelId == ctx.Activity.From.Id)
            {
                PromptDialog.Choice(ctx, SelectNextDialog, new[] {"Add PR", "Remove last added PR", "Remove any PR", "Admin"}, "What do you want to do today?");
            }
            else
            {
                throw new NotImplementedException();
            }
            return Task.CompletedTask;
        }

        private async Task SelectNextDialog(IDialogContext context, IAwaitable<string> result)
        {
            try
            {
                var nextDialog = await result;
                switch (nextDialog)
                {
                    case "Add PR":
                        context.Call(new PromptStringRegex("Get me a link to you PR, please", "https://github.com/(\\S+)/(\\S+)/pull/(\\d+)"), CallbackAsync);
                        break;
                }
            }
            catch (TooManyAttemptsException)
            {
                await StartAsync(context);
            }
        }

        private async Task CallbackAsync(IDialogContext context, IAwaitable<string> result)
        {
            var link = await result;
            await context.PostAsync($"You link is {link}");
            await StartAsync(context);
        }
    }
}