using System;
using System.Text.RegularExpressions;
using Microsoft.Bot.Builder.Dialogs;
using Microsoft.Bot.Builder.Dialogs.Internals;
using Microsoft.Bot.Connector;

namespace AenSidhe.MergeQueueBot.Dialogs
{
    [Serializable]
    public class PromptStringRegex : Prompt<string, string>
    {
        private readonly Regex _regex;

        public PromptStringRegex(string prompt, string regexPattern, string retry = null, string tooManyAttempts = null, int attempts = 3)
            : base(new PromptOptions<string>(prompt, retry, tooManyAttempts, attempts: attempts))
        {
            _regex = new Regex(regexPattern, RegexOptions.Compiled | RegexOptions.IgnoreCase | RegexOptions.IgnorePatternWhitespace);
        }

        protected override bool TryParse(IMessageActivity message, out string result)
        {
            var quitCondition = message.Text.Equals("Cancel", StringComparison.InvariantCultureIgnoreCase);
            var success = _regex.Match(message.Text).Success;

            result = success ? message.Text : null;

            return success || quitCondition;
        }
    }
}