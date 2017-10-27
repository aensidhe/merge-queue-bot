using ProGaudi.MsgPack.Light;

namespace AenSidhe.MergeQueueBot.Models
{
    [MsgPackArray]
    public class PullRequest
    {
        [MsgPackArrayElement(0)]
        public int Id { get; set; }

        [MsgPackArrayElement(1)]
        public string Etag { get; set; }

        [MsgPackArrayElement(2)]
        public int ReporterId { get; set; }

        [MsgPackArrayElement(3)]
        public int RepositoryId { get; set; }

        [MsgPackArrayElement(4)]
        public int GithubId { get; set; }

        [MsgPackArrayElement(5)]
        public PullRequestState State { get; set; }
    }
}