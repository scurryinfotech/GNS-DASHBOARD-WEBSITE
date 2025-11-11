using Microsoft.AspNetCore.Mvc;

namespace ScurryDashboard.Controllers
{
    public class DashboardController : Controller
    {
        public IActionResult Index()
        {
            return View();
        }
    }
}
