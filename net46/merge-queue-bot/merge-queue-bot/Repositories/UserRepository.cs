using System.Threading.Tasks;
using ProGaudi.Tarantool.Client;

namespace AenSidhe.MergeQueueBot.Repositories
{
    public class UserRepository : IQueryableRepository<User>, IUpdatableRepository<User>
    {
        private readonly IBox _box;

        public UserRepository(IBox box)
        {
            _box = box;
        }

        public Task<User> Get(ISelectQuery<User> selectQuery) => selectQuery.Process(_box);

        public Task<User> Update(IChangeQuery<User> changeQuery) => changeQuery.Process(_box, _box.Schema);
    }
}