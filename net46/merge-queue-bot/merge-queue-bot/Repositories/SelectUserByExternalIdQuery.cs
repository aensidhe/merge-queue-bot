using System;
using System.Threading.Tasks;
using AenSidhe.MergeQueueBot.Models;
using ProGaudi.Tarantool.Client;

namespace AenSidhe.MergeQueueBot.Repositories
{
    public class SelectUserByExternalIdQuery : IGetQuery<User>
    {
        private readonly string _userId;

        public SelectUserByExternalIdQuery(string userId)
        {
            _userId = userId;
        }

        public async Task<User> Process(IBox box)
        {
            try
            {
                var index = box.Schema["users"]["external"];
                var users = await index.Select<ValueTuple<string>, User>(ValueTuple.Create(_userId));
                return users.Data.Length == 0 ? null : users.Data[0];
            }
            catch (Exception e)
            {
                Console.WriteLine(e);
                throw;
            }
        }
    }
}