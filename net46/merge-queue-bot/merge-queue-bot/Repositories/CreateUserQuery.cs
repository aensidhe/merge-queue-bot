﻿using System.Threading.Tasks;
using AenSidhe.MergeQueueBot.Models;
using ProGaudi.Tarantool.Client;

namespace AenSidhe.MergeQueueBot.Repositories
{
    public class CreateUserQuery : IChangeQuery<User>
    {
        private readonly string _name;
        private readonly string _externalId;

        public CreateUserQuery(string name, string externalId)
        {
            _name = name;
            _externalId = externalId;
        }

        public async Task<User> Process(IBox box)
        {
            var space = box.Schema["users"];

            var (id, name, externalId) = (await space.Insert((default(int?), _name, _externalId))).Data[0];
            return new User
            {
                Id = id.Value,
                ExternalId = externalId,
                Name = name
            };
        }
    }
}