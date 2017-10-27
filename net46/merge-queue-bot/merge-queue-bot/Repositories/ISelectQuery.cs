using System.Collections.Generic;
using System.Threading.Tasks;
using ProGaudi.Tarantool.Client;

namespace AenSidhe.MergeQueueBot.Repositories
{
    public interface ISelectQuery<T>
    {
        Task<IEnumerable<T>> Process(IBox box);
    }
}