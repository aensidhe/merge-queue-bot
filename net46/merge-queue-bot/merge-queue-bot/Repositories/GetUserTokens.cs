using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using AenSidhe.MergeQueueBot.Models;
using ProGaudi.Tarantool.Client;

namespace AenSidhe.MergeQueueBot.Repositories
{
    public class GetUserTokens : ISelectQuery<GithubToken>
    {
        public User Owner { get; }

        public GetUserTokens(User owner)
        {
            Owner = owner;
        }

        public async Task<IEnumerable<GithubToken>> Process(IBox box)
        {
            return (await box.Schema["github_tokens"]["user_id"]
                    .Select<ValueTuple<int>, GithubToken>(ValueTuple.Create(Owner.Id)))
                .Data;
        }
    }
}