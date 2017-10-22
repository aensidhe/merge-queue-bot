using System.Threading.Tasks;

namespace AenSidhe.MergeQueueBot.Repositories
{
    public interface IUpdatableRepository<T>
    {
        Task<T> Update(IChangeQuery<T> changeQuery);
    }
}