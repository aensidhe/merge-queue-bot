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
            context.Wait(async (ctx, resume) =>
            {
                PromptDialog.Choice(ctx, SelectNextDialog, new[] { "Add PR", "Remove PR", "View queue" }, "What do you want to do today?");
                var result = await resume;
            });

            return Task.CompletedTask;
        }

        private async Task SelectNextDialog(IDialogContext context, IAwaitable<string> result)
        {
            var length = (await result).Length;
            context.Done($"Your choice contains {length} chars");
        }
    }
}