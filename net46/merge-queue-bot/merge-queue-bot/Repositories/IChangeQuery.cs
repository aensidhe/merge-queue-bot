using System.Threading.Tasks;
using ProGaudi.Tarantool.Client;

namespace AenSidhe.MergeQueueBot.Repositories
{
    public interface IChangeQuery<T>
    {
        Task<T> Process(IBox box, ISchema schema);
    }
}