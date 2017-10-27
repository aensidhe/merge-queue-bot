using System.Collections.Generic;
using System.Threading.Tasks;

namespace AenSidhe.MergeQueueBot.Repositories
{
    public interface IQueryableRepository<T>
    {
        Task<T> Get(IGetQuery<T> selectQuery);

        Task<IEnumerable<T>> Select(ISelectQuery<T> selectQuery);
    }
}