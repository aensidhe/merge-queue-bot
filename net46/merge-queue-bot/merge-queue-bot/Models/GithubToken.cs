using ProGaudi.MsgPack.Light;

namespace AenSidhe.MergeQueueBot.Models
{
    [MsgPackArray]
    public class GithubToken
    {
        [MsgPackArrayElement(0)]
        public int Id { get; set; }

        [MsgPackArrayElement(1)]
        public string Name { get; set; }

        [MsgPackArrayElement(2)]
        public int OwnerId { get; set; }

        [MsgPackArrayElement(3)]
        public string Token { get; set; }
    }
}