using ProGaudi.MsgPack.Light;

namespace AenSidhe.MergeQueueBot.Models
{
    [MsgPackArray]
    public class GithubRepository
    {
        [MsgPackArrayElement(0)]
        public int Id { get; set; }

        [MsgPackArrayElement(1)]
        public string Organization { get; set; }

        [MsgPackArrayElement(2)]
        public string Name { get; set; }

        [MsgPackArrayElement(3)]
        public int TokenId { get; set; }
    }
}