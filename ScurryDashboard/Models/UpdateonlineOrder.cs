using System.Text.Json.Serialization;

namespace ScurryDashboard.Models
{
    public class UpdateonlineOrder
    {
        [JsonPropertyName("orderId")]
        public string OrderId { get; set; }

        [JsonPropertyName("orderStatus")]
        public int OrderStatus { get; set; }


    }
}
