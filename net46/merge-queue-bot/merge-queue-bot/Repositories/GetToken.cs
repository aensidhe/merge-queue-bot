using System;
using System.Threading.Tasks;
using AenSidhe.MergeQueueBot.Models;
using ProGaudi.Tarantool.Client;

namespace AenSidhe.MergeQueueBot.Repositories
{
    public class GetToken : IGetQuery<GithubToken>
    {
        public string Name { get; }
        public User Owner { get; }

        public GetToken(string name, User owner)
        {
            Name = name;
            Owner = owner;
        }

        public async Task<GithubToken> Process(IBox box)
        {
            return (await box.Schema["github_tokens"]["user_id"]
                .Select<ValueTuple<int>, GithubToken>(ValueTuple.Create(Owner.Id)))
                .Data[0];
        }
    }
}