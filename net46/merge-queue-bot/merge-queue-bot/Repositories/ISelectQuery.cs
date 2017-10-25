using System.Threading.Tasks;
using ProGaudi.Tarantool.Client;

namespace AenSidhe.MergeQueueBot.Repositories
{
    public interface ISelectQuery<T>
    {
        Task<T> Process(IBox box);
    }
}