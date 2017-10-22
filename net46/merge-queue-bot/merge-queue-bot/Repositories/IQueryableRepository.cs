using System.Threading.Tasks;

namespace AenSidhe.MergeQueueBot.Repositories
{
    public interface IQueryableRepository<T>
    {
        Task<T> Get(ISelectQuery<T> selectQuery);
    }
}