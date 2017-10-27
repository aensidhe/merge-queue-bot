using System;
using System.Threading.Tasks;
using AenSidhe.MergeQueueBot.Models;
using ProGaudi.Tarantool.Client;
using ProGaudi.Tarantool.Client.Model.UpdateOperations;

namespace AenSidhe.MergeQueueBot.Repositories
{
    public class MapTokenToRepoQuery : IChangeQuery<GithubRepository>
    {
        public string Organization { get; }
        public string Name { get; }
        public GithubToken Token { get; }

        public MapTokenToRepoQuery(string organization, string name, GithubToken token)
        {
            Organization = organization;
            Name = name;
            Token = token;
        }

        public async Task<GithubRepository> Process(IBox box)
        {
            var space = box.Schema["repository"];
            var existing = (await space["organization_name"].Select<(string, string), GithubRepository>((Organization, Name))).Data;
            if (existing.Length == 0)
            {
                var inserted = (await space.Insert((default(int?), Organization, Name, Token.Id))).Data;
                return new GithubRepository
                {
                    Name = inserted[0].Item3,
                    Organization = inserted[0].Item2,
                    Id = inserted[0].Item1.Value,
                    TokenId = inserted[0].Item4
                };
            }

            return (await space.Update<ValueTuple<int>, GithubRepository>(ValueTuple.Create(existing[0].Id), new UpdateOperation[] {UpdateOperation.CreateAssign(4, Token.Id)}))
                .Data[0];
        }
    }
}