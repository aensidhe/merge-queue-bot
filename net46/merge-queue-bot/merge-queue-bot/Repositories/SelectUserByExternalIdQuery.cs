using System;
using System.Threading.Tasks;
using ProGaudi.Tarantool.Client;

namespace AenSidhe.MergeQueueBot.Repositories
{
    public class SelectUserByExternalIdQuery : ISelectQuery<User>
    {
        private readonly string _userId;

        public SelectUserByExternalIdQuery(string userId)
        {
            _userId = userId;
        }

        public async Task<User> Process(IBox box, ISchema schema)
        {
            try
            {
                var space = await schema.GetSpace("users");
                var index = await space.GetIndex("external");
                var users = await index.Select<string, User>(_userId);
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