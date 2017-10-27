using System.Collections.Generic;
using System.Threading.Tasks;
using ProGaudi.Tarantool.Client;

namespace AenSidhe.MergeQueueBot.Repositories
{
    public class TarantoolRepository<T> : IQueryableRepository<T>, IUpdatableRepository<T>
    {
        private readonly IBox _box;

        public TarantoolRepository(IBox box)
        {
            _box = box;
        }

        public Task<T> Update(IChangeQuery<T> changeQuery) => changeQuery.Process(_box);

        public Task<T> Get(IGetQuery<T> selectQuery) => selectQuery.Process(_box);

        public Task<IEnumerable<T>> Select(ISelectQuery<T> selectQuery) => selectQuery.Process(_box);
    }
}