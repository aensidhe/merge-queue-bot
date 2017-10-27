using System.Threading.Tasks;
using AenSidhe.MergeQueueBot.Models;
using ProGaudi.Tarantool.Client;
using ProGaudi.Tarantool.Client.Model.UpdateOperations;

namespace AenSidhe.MergeQueueBot.Repositories
{
    public class UnmapTokenFromRepoQuery : IChangeQuery<GithubRepository>
    {
        public string Organization { get; }
        public string Name { get; }
        public GithubToken Token { get; }

        public UnmapTokenFromRepoQuery(string organization, string name, GithubToken token)
        {
            Organization = organization;
            Name = name;
            Token = token;
        }

        public async Task<GithubRepository> Process(IBox box)
        {
            return (await box.Schema["repository"]["organization_name"].Update<GithubRepository, (string, string)>(
                (Organization, Name), new UpdateOperation[]
                {
                    UpdateOperation.CreateDelete(4, 1)
                })).Data[0];
        }
    }
}