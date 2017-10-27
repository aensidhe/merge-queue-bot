using System.Threading.Tasks;
using ProGaudi.Tarantool.Client;

namespace AenSidhe.MergeQueueBot.Repositories
{
    public interface IGetQuery<T>
    {
        Task<T> Process(IBox box);
    }
}