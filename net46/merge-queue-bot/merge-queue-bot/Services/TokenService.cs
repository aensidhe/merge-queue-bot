using System.Collections.Generic;
using System.Threading.Tasks;
using AenSidhe.MergeQueueBot.Models;
using AenSidhe.MergeQueueBot.Repositories;

namespace AenSidhe.MergeQueueBot.Services
{
    public class TokenService
    {
        private readonly IQueryableRepository<GithubToken> _queryRepository;
        private readonly IUpdatableRepository<GithubToken> _updateRepository;

        public TokenService(IQueryableRepository<GithubToken> queryRepository, IUpdatableRepository<GithubToken> updateRepository)
        {
            _queryRepository = queryRepository;
            _updateRepository = updateRepository;
        }

        public Task<GithubToken> Create(string token, string name, User owner)
        {
            return _updateRepository.Update(new CreateNewTokenQuery(name, token, owner));
        }

        public Task<IEnumerable<GithubToken>> GetTokens(User owner)
        {
            return _queryRepository.Select(new GetUserTokens(owner));
        }

        public Task<GithubToken> GetToken(string name, User owner)
        {
            return _queryRepository.Get(new GetToken(name, owner));
        }

        public Task<GithubToken> DeleteToken(string name, User owner)
        {
            return _updateRepository.Update(new DeleteUserToken(name, owner));
        }
    }
}