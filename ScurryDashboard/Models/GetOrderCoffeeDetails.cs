namespace ScurryDashboard.Models
{
    public class GetOrderCoffeeDetails
    {
        public int OrderId { get; set; }
        public string OrderNumber { get; set; }
        public string CustomerName { get; set; }
        public string CustomerPhone { get; set; }
        public DateTime OrderDate { get; set; }
        // Coffee details
        public string CoffeeName { get; set; }
        public string Description { get; set; }
        // Order item details
        public int Quantity { get; set; }
        public decimal Price { get; set; }
        public decimal TotalPrice { get; set; }
    }
}
