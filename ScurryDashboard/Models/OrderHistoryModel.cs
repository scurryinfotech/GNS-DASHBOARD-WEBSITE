namespace ScurryDashboard.Models
{
    public class OrderHistoryModel
    {
        public string OrderId { get; set; }
        public string CustomerName { get; set; }
        public string Phone { get; set; }
        public int TableNo { get; set; }
        public string ItemName { get; set; }
        public int FullPortion { get; set; }
        public int HalfPortion { get; set; }
        public decimal Price { get; set; }
        public decimal TotalAmount { get; set; }
        public decimal DiscountAmount { get; set; }
        public decimal FinalAmount { get; set; }
        public string PaymentMode { get; set; }
        public DateTime Date { get; set; }
    }
}
