using System.Threading.Tasks;
using AenSidhe.MergeQueueBot.Models;
using ProGaudi.Tarantool.Client;

namespace AenSidhe.MergeQueueBot.Repositories
{
    public class CreateNewTokenQuery : IChangeQuery<GithubToken>
    {
        public string Name { get; }
        public string Token { get; }
        public User Owner { get; }

        public CreateNewTokenQuery(string name, string token, User owner)
        {
            Name = name;
            Token = token;
            Owner = owner;
        }

        public async Task<GithubToken> Process(IBox box)
        {
            var result = (await box.Schema["github_tokens"].Insert((default(int?), Name, Owner.Id, Token))).Data[0];
            return new GithubToken
            {
                Id = result.Item1.Value,
                Name = result.Item2,
                OwnerId = result.Item3,
                Token = result.Item4
            };
        }
    }
}