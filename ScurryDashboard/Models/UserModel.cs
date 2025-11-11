using System;
using System.Text.Json.Serialization;

namespace ScurryDashboard.Models
{
    public class UserModel
    {
        [JsonPropertyName("loginame")]
        public string loginame { get; set; }

        [JsonPropertyName("password")]
        public string Password { get; set; }

        [JsonPropertyName("name")]
        public string? Name { get; set; }

        [JsonPropertyName("createdDate")]
        public DateTime? CreatedDate { get; set; }

        [JsonPropertyName("isActive")]
        public bool? IsActive { get; set; }
    }
}
