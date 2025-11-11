using System;
using System.Text.Json.Serialization;

public class OrderListModel
{
    [JsonPropertyName("tableNo")]
    public int? TableNo { get; set; }

    [JsonPropertyName("id")]
    public int Id { get; set; }
    [JsonPropertyName("orderId")]
    public string? OrderId { get; set; }

    [JsonPropertyName("itemName")]
    public string ItemName { get; set; }

    [JsonPropertyName("halfPortion")]
    public int HalfPortion { get; set; }

    [JsonPropertyName("fullPortion")]
    public int FullPortion { get; set; }

    [JsonPropertyName("price")]
    public decimal Price { get; set; }

    [JsonPropertyName("orderStatusId")]
    public int? OrderStatusId { get; set; }  

    [JsonPropertyName("orderStatus")]
    public string OrderStatus { get; set; }

    [JsonPropertyName("StatusId")]
    public int? statusId { get; set; }


    [JsonPropertyName("date")]
    public DateTime Date { get; set; }

    [JsonPropertyName("isActive")]
    public int IsActive { get; set; }

    [JsonPropertyName("customerName")]
    public string? customerName { get; set; }

    [JsonPropertyName("phone")]
    public string? phone { get; set; }

    [JsonPropertyName("orderType")]
    public string? OrderType { get; set; }

    [JsonPropertyName("address")]
    public string? Address { get; set; }
    [JsonPropertyName("paymentMode")]
    public string? PaymentMode { get; set; }
    public DateTime? ModifiedDate { get; set; }

    [JsonPropertyName("Createddate")]
    public DateTime? createdDate { get; set; }

    [JsonPropertyName ("Specialinstrustion")]
    public string? specialInstructions { get; set; }
    

}
