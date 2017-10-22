using ProGaudi.MsgPack.Light;

namespace AenSidhe.MergeQueueBot.Repositories
{
    [MsgPackArray]
    public class User
    {
        [MsgPackArrayElement(0)]
        public int Id { get; set; }

        [MsgPackArrayElement(1)]
        public string Name { get; set; }

        [MsgPackArrayElement(2)]
        public string ExternalId { get; set; }
    }
}