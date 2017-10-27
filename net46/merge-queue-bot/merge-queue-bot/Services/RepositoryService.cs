using System.Threading.Tasks;
using AenSidhe.MergeQueueBot.Models;
using AenSidhe.MergeQueueBot.Repositories;

namespace AenSidhe.MergeQueueBot.Services
{
    public class RepositoryService
    {
        private readonly TokenService _tokenService;
        private readonly IUpdatableRepository<GithubRepository> _githubRepoUpdateRepository;

        public RepositoryService(IUpdatableRepository<GithubRepository> githubRepoUpdateRepository, TokenService tokenService)
        {
            _githubRepoUpdateRepository = githubRepoUpdateRepository;
            _tokenService = tokenService;
        }

        public async Task MapTokenToRepository(string organization, string name, string tokenName, User owner)
        {
            var token = await _tokenService.GetToken(tokenName, owner);

            await _githubRepoUpdateRepository.Update(new MapTokenToRepoQuery(organization, name, token));
        }


        public async Task UnmapTokenFromRepository(string organization, string name, string tokenName, User owner)
        {
            var token = await _tokenService.GetToken(tokenName, owner);

            await _githubRepoUpdateRepository.Update(new UnmapTokenFromRepoQuery(organization, name, token));
        }
    }
}