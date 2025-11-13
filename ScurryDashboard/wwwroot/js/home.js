let arrTable;
let liveOrdersTable;
let currentTableNo = null; // Track current table for Accept Order
let orderHistory = [];
let selectedPaymentMode = null;
let prevNewOrderIds = [];// Store completed orders history

// --- Audio/Beep Control Variables ---
let audioBeep = null;
let isBeepPlaying = false;
let beepIntervalId = null;

let selectedHistoryDate = "";
let selectedHistoryTableNo = "";

let beepTables = {};
let reminderTimers = {};
let orderReceivedTimes = {};
let orderAcceptedTimes = {};
let completionTimers = {};
let currentOrderId = null;
let currentOrderData = null;
let lastBeepTime = 0;

let audioUnlocked = false;

function dateKeyFromISO(iso) {
    if (!iso) return "";


    const normalized = iso.includes("T") ? iso : iso.replace(" ", "T");

    const d = new Date(normalized);
    if (isNaN(d)) {
        console.warn("Invalid completedAt date:", iso);
        return "";
    }

    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
}




function displayDateFromKey(key) {
    const d = new Date(key);
    return d.toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric"
    });
}


$('#stopBeepBtnmain').click(function () {


    stopAllBeeps();

});


$(document).on("click keydown touchstart", function unlockAudio() {
    if (!audioUnlocked) {
        const testAudio = new Audio("/sound/alarm.mp3.mp3");
        testAudio.play()
            .then(() => {
                testAudio.pause();
                testAudio.currentTime = 0;
                audioUnlocked = true;
                console.log("✅ Audio unlocked — future playbacks allowed");
            })
            .catch(err => console.warn("⚠️ Audio unlock blocked:", err));

        $(document).off("click keydown touchstart", unlockAudio);
    }
});

function playBeep() {

    if (!audioUnlocked) {
        
        return;
    }
    if (isBeepPlaying) return;

    try {
        if (!audioBeep) {
            audioBeep = new Audio('/sound/alarm.mp3.mp3');
            audioBeep.loop = true;
        }

        const playPromise = audioBeep.play();

        if (playPromise !== undefined) {
            playPromise
                .then(() => {
                    console.log('Beep started');
                    isBeepPlaying = true;
                    showStopBeepButton();
                })
                .catch(err => {
                    console.warn('Audio play blocked by browser:', err);
                    isBeepPlaying = false;
                });
        }

    } catch (error) {
        console.error('Audio play exception:', error);
        isBeepPlaying = false;
    }
}




function stopBeep() {
    if (audioBeep) {
        try {
            audioBeep.pause();
            audioBeep.currentTime = 0;
            audioBeep.loop = false;
        } catch (e) {
            console.error('Error stopping audioBeep:', e);
        }
    }
    isBeepPlaying = false; // reset flag properly
    //hideStopBeepButton();
}

//function showStopBeepButton() {

//    $('#stopBeepBtn').remove();


//    const stopBtn = `
//        <button id="stopBeepBtn" class="btn btn-danger btn-sm position-fixed" 
//                style="top: 20px; right: 20px; z-index: 9999; display: block;">
//            <i class="fas fa-stop"></i> Stop Alarm
//        </button>
//    `;
//    $('body').append(stopBtn);
//}

//function hideStopBeepButton() {
//    $('#stopBeepBtn').remove();
//}


function checkAndStopBeepIfNoProblems() {
    const data = window.liveOrdersData || [];
    const newOrders = data.filter(order => order.orderStatusId === 1);
    const overdueOrders = data.filter(order => {
        if (order.orderStatusId !== 2) return false;
        const acceptedTime = orderAcceptedTimes[order.id];
        if (!acceptedTime) return false;
        const elapsed = Date.now() - acceptedTime;
        return elapsed > 10 * 60 * 1000;
    });

    if (newOrders.length === 0 && overdueOrders.length === 0) {
        
        stopAllBeeps(); 
    }
}

// NEW: Stop all per-table beeps
function stopAllTableBeeps() {
    Object.keys(beepTables).forEach(tableNo => {
        try {
            if (beepTables[tableNo]) {
                beepTables[tableNo].pause();
                beepTables[tableNo].currentTime = 0;
                beepTables[tableNo].loop = false;
                delete beepTables[tableNo];
            }
        } catch (error) {
            console.error(`Error stopping beep for table ${tableNo}:`, error);
            delete beepTables[tableNo];
        }
    });

}
function stopAllBeeps() {

    stopBeep();


    Object.keys(beepTables).forEach(tableNo => {
        try {
            const beep = beepTables[tableNo];
            if (beep) {
                beep.pause();
                beep.currentTime = 0;
                beep.loop = false;
                delete beepTables[tableNo];
            }
        } catch (error) {
            console.error(`Error stopping beep for table ${tableNo}:`, error);
            delete beepTables[tableNo];
        }
    });
}



$(document).ready(function () {


    setInterval(function () {
        loadTableOrders(false);
        
    }, 3000);
    loadTableCount();

    renderOrders();
    updateNewOrdersBadge();
    //getOrdersFromRestaurant();
    //setInterval(function () {
    //    getOrdersFromRestaurant(false);
    //}, 30000);

    $(document).on('click', '.card', function () {
      
        const tableTitle = $(this).find('.card-title').text();
        $('.modal-title').text(tableTitle);
        currentTableNo = parseInt(tableTitle.replace('Table', ''));
        $('.card').addClass('m-3 card-click-animation card-click-opacity');
        $(this).removeClass('m-3 card-click-opacity');
        updateOrderDetails(tableTitle);
    });


    $(document).on('click', '#stopBeepBtn', function () {
        stopBeep();
        stopAllTableBeeps();
    });


    $(document).on('click', '#confirmOrderBtn', function () {
        const $btn = $(this);
        const tableTitle = $('.modal-title').text();
        const tableNo = parseInt(tableTitle.replace('Table', ''));
        const data = window.liveOrdersData || [];

        if ($btn.data('mode') !== 'complete') {

            const assigningOrders = data.filter(order => order.tableNo === tableNo && order.orderStatusId === 1);
            if (assigningOrders.length === 0) {
                showSuccessMessage('No assigning orders to accept!');
                return;
            }

            let completedAccepts = 0;
            const totalAccepts = assigningOrders.length;

            assigningOrders.forEach(order => {
                acceptOrder(order, function () {
                    completedAccepts++;
                    if (completedAccepts === totalAccepts) {
                        showSuccessMessage(`Accepted ${totalAccepts} order(s) for Table ${tableNo}!`);

                        setTimeout(() => {
                            checkAndStopBeepIfNoProblems();
                        }, 100);


                        setTimeout(() => {
                            updateConfirmOrderBtn(tableNo);
                            updateOrderDetails(tableTitle);
                        }, 500);
                    }
                });
            });
        } else {

            const activeOrders = data.filter(order => order.tableNo === tableNo && order.orderStatusId === 2);
            if (activeOrders.length === 0) {
                showSuccessMessage('No active orders to complete!');
                return;
            }

            let completedCompletes = 0;
            const totalCompletes = activeOrders.length;

            activeOrders.forEach(order => {
                completeOrder(order, function () {
                    completedCompletes++;
                    if (completedCompletes === totalCompletes) {
                        showSuccessMessage(`Completed ${totalCompletes} order(s) for Table ${tableNo}!`);
                       
                        updateConfirmOrderBtn(tableNo);
                        updateOrderDetails(tableTitle);
                    }
                });
            });
        }
    });


    $(document).on('show.bs.modal', '#divInProgressModal', function () {
        const tableTitle = $(this).find('.modal-title').text().trim();
        const tableNo = parseInt(tableTitle.replace('Table', ''));
        updateConfirmOrderBtn(tableNo);
    });
});

function loadTableOrders() {
    $.ajax({
        url: '/home/GetOrder',
        type: 'GET',
        success: function (data) {

            window.liveOrdersData = data || [];
            filterCompletedOrdersToHistory();

            const now = Date.now();
            const assigningOrders = window.liveOrdersData.filter(order => order.orderStatusId === 1);
            const activeOrders = window.liveOrdersData.filter(order => order.orderStatusId === 2);


            assigningOrders.forEach(order => {
                if (!orderReceivedTimes[order.id]) {
                    orderReceivedTimes[order.id] = order.date ? new Date(order.date).getTime() : now;
                }
            });


            activeOrders.forEach(order => {
                if (!orderAcceptedTimes[order.id]) {

                    orderAcceptedTimes[order.id] = now;
                }

                // Set up completion timer if not already set
                if (!completionTimers[order.id]) {
                    const acceptedTime = orderAcceptedTimes[order.id];
                    const elapsed = now - acceptedTime;
                    const msLeft = Math.max(0, 10 * 60 * 1000 - elapsed);

                    completionTimers[order.id] = setTimeout(function completionReminder() {
                        // Check if order is still active
                        const stillActive = (window.liveOrdersData || []).some(o => o.id === order.id && o.orderStatusId === 2);
                        if (stillActive) {




                            //if (!beepTables[order.tableNo]) {
                            //    try {
                            //        const audio = new Audio('/sound/alarm.mp3.mp3');
                            //        audio.loop = true;
                            //        audio.play().then(() => {
                            //            beepTables[order.tableNo] = audio;
                            //        }).catch(err => console.error('Table beep error:', err));
                            //    } catch (err) {
                            //        console.error('Table beep creation error:', err);
                            //    }
                            //}

                            // Also trigger universal beep
                            //playBeep();

                            // Set next reminder in 5 minutes
                            completionTimers[order.id] = setTimeout(completionReminder, 5 * 60 * 1000);
                        } else {
                            // Order completed, clear timer
                            clearTimeout(completionTimers[order.id]);
                            delete completionTimers[order.id];
                            delete orderAcceptedTimes[order.id];
                        }
                    }, msLeft);
                }
            });


            Object.keys(completionTimers).forEach(orderId => {
                if (!activeOrders.some(o => o.id == orderId)) {
                    clearTimeout(completionTimers[orderId]);
                    delete completionTimers[orderId];
                    delete orderAcceptedTimes[orderId];
                }
            });

            // Remove received times for orders that are no longer assigning
            Object.keys(orderReceivedTimes).forEach(orderId => {
                if (!assigningOrders.some(o => o.id == orderId)) {
                    delete orderReceivedTimes[orderId];
                    if (reminderTimers[orderId]) {
                        clearTimeout(reminderTimers[orderId]);
                        delete reminderTimers[orderId];
                    }
                }
            });

           
            const newOrderTables = [...new Set(assigningOrders.map(o => o.tableNo))];

          
            if (newOrderTables.length > 0 && !isBeepPlaying) {
                playBeep();
            }

           
            if (newOrderTables.length === 0) {
                checkAndStopBeepIfNoProblems();
            }

            Object.keys(beepTables).forEach(tableNo => {
                const hasNewOrders = newOrderTables.includes(Number(tableNo));
                const hasOverdueOrders = activeOrders.some(order => {
                    if (order.tableNo !== Number(tableNo)) return false;
                    const acceptedTime = orderAcceptedTimes[order.id];
                    if (!acceptedTime) return false;
                    const elapsed = now - acceptedTime;
                    return elapsed > 10 * 60 * 1000;
                });

                if (!hasNewOrders && !hasOverdueOrders) {
                    beepTables[tableNo].pause();
                    beepTables[tableNo].currentTime = 0;
                    delete beepTables[tableNo];
                }
            });

            // --- Reminder logic for assigning orders (5-minute reminders) ---
            assigningOrders.forEach(order => {
                if (!reminderTimers[order.id]) {
                    const receivedTime = orderReceivedTimes[order.id];
                    const elapsed = now - receivedTime;
                    const msLeft = Math.max(0, 5 * 60 * 1000 - elapsed); // 5 minutes in ms

                    reminderTimers[order.id] = setTimeout(function reminder() {
                        const stillAssigning = (window.liveOrdersData || []).some(o => o.id === order.id && o.orderStatusId === 1);
                        if (stillAssigning) {
                            // Play beep for this table
                            if (!beepTables[order.tableNo]) {
                                try {
                                    const audio = new Audio('/sound/alarm.mp3.mp3');
                                    audio.loop = true;
                                    audio.play().then(() => {
                                        beepTables[order.tableNo] = audio;
                                    }).catch(err => console.error('Reminder beep error:', err));
                                } catch (err) {
                                    console.error('Reminder beep creation error:', err);
                                }
                            }
                            // Set next reminder in 5 minutes
                            reminderTimers[order.id] = setTimeout(reminder, 5 * 60 * 1000);
                        } else {
                            // Order accepted, clear timer
                            clearTimeout(reminderTimers[order.id]);
                            delete reminderTimers[order.id];
                            delete orderReceivedTimes[order.id];
                        }
                    }, msLeft);
                }
            });

            
            if (!window.prevNewOrderTables) window.prevNewOrderTables = [];
            newOrderTables.forEach(tableNo => {
                
                if (!window.prevNewOrderTables.includes(tableNo)) {
                    $('.modal-title').text('Table ' + tableNo);
                    $('#divInProgressModal').modal('show');
                    updateOrderDetails('Table ' + tableNo);
                }
            });
            window.prevNewOrderTables = newOrderTables;

            initializeLiveOrdersTable(window.liveOrdersData);
            bindDynamicTable();
            updateStats();
        },
        error: function () {
            window.liveOrdersData = [];
            initializeLiveOrdersTable(window.liveOrdersData);
            bindDynamicTable();
            updateStats();
        }
    });
}

    
function filterCompletedOrdersToHistory() {
    if (!window.liveOrdersData) return;


    const completedOrders = window.liveOrdersData.filter(order => order.orderStatusId === 3);
    const activeOrders = window.liveOrdersData.filter(order => order.orderStatusId !== 3);

    
    completedOrders.forEach(order => {
        if (!orderHistory.find(h => h.id === order.id)) {
            orderHistory.push({
                ...order,
                completedAt: order.completedAt || new Date().toISOString()
            });
        }
    });

    window.liveOrdersData = activeOrders;
}


function loadTableCount() {
    $.ajax({
        url: '/home/GetTableCount',
        type: 'GET',
        success: function (data) {
            let count = typeof data === "object" ? data.count : parseInt(data);
            arrTable = Array.from({ length: count }, (_, i) => i + 1);
            bindDynamicTable();
        },
        error: function () {
            showSuccessMessage('Failed to load table count!');
        }
    });
}

// Initialize DataTable for live orders (only active/assigning orders)
function initializeLiveOrdersTable(data) {
    if ($.fn.DataTable.isDataTable('#liveOrdersTable')) {
        liveOrdersTable.clear().rows.add(data).draw();
        return;
    }

    liveOrdersTable = $('#liveOrdersTable').DataTable({
        "data": data,
        "pageLength": 10,
        "order": [[4, "desc"]],
        "columns": [
            { "data": "tableNo", "title": "Table No" },
            { "data": "id", "title": "ID" },
            { "data": "itemName", "title": "Item Name" },
            { "data": "halfPortion", "title": "Half" },
            { "data": "fullPortion", "title": "Full" },
            { "data": "price", "title": "Price" },
            { "data": "orderStatusId", "title": "Status ID" },
            { "data": "date", "title": "Date" }
        ],
        "rowCallback": function (row, data) {
            if (data.orderStatusId === 1) {
                $(row).addClass('bg-warning');
            } else if (data.orderStatusId === 2) {
                // Check if this active order is overdue
                const acceptedTime = orderAcceptedTimes[data.id];
                if (acceptedTime && (Date.now() - acceptedTime) > 10 * 60 * 1000) {
                    $(row).addClass('bg-danger text-white'); // Overdue orders in red
                } else {
                    $(row).addClass('bg-info');
                }
            }
        },
        "autoWidth": false,
        "destroy": true
    });
}

// Render table cards for each table (only showing active/assigning orders)
function bindDynamicTable() {
    let tblhtml = '';
    const data = window.liveOrdersData || [];
    if (!Array.isArray(arrTable)) return;

    arrTable.forEach(function (tbl, i) {
        if (i % 3 == 0)
            tblhtml += '<div class="row p-2"><div class="card-group" style="width: 100%; height: 100%;">';

        
        const tableOrders = data.filter(order => order.tableNo === tbl && order.orderStatusId !== 3);
        let totalPrice = 0;
        tableOrders.forEach(order => {
            totalPrice += (Number(order.halfPortion) + Number(order.fullPortion)) * Number(order.price);
        });


        let cardClass = 'bg-success';
        let statusText = 'Available';

        if (tableOrders.length > 0) {
            const hasAssigningOrders = tableOrders.some(order => order.orderStatusId === 1);
            const hasActiveOrders = tableOrders.some(order => order.orderStatusId === 2);

            // Check for overdue orders
            const hasOverdueOrders = tableOrders.some(order => {
                if (order.orderStatusId !== 2) return false;
                const acceptedTime = orderAcceptedTimes[order.id];
                if (!acceptedTime) return false;
                return (Date.now() - acceptedTime) > 10 * 60 * 1000;
            });

            if (hasAssigningOrders) {
                cardClass = 'bg-warning';
                statusText = 'Assigning Order';
            } else if (hasOverdueOrders) {
                cardClass = 'bg-danger';
                statusText = 'Delay in Serving';
            } else if (hasActiveOrders) {
                cardClass = 'bg-info';
                statusText = 'Active';
            }
        }

        tblhtml += `<div class="card text-white ${cardClass} m-3 card-click-animation" data-toggle="modal" data-target="#divInProgressModal">`;
        tblhtml += `<div class="card-body"><center><h5 class="card-title">Table ${tbl}</h5>`;
        tblhtml += `<div><strong>Total: ₹${totalPrice}</strong></div></center></div>`;
        tblhtml += `<div class="card-footer"><center><small>${statusText}</small></center></div>`;
        tblhtml += `</div>`;

        if (i % 3 == 2)
            tblhtml += '</div></div>';
    });

    
    if (arrTable.length % 3 !== 0) {
        tblhtml += '</div></div>';
    }

    $('#divTable').html(tblhtml);

    renderOrderHistory();
}


function renderOrderHistory() {
    if (orderHistory.length === 0) return;

    const getOrderDate = (o) => o.completedAt || o.date;

    const uniqueTables = [...new Set(orderHistory.map(o => o.tableNo))].sort((a, b) => a - b);

    const uniqueDateKeys = [
        ...new Set(orderHistory.map(o => dateKeyFromISO(getOrderDate(o))))
    ].filter(k => k !== "").sort((a, b) => b.localeCompare(a));

    let filtered = orderHistory.filter(o => getOrderDate(o));
    if (selectedHistoryDate) {
        filtered = filtered.filter(o => dateKeyFromISO(getOrderDate(o)) === selectedHistoryDate);
    }
    if (selectedHistoryTableNo) {
        filtered = filtered.filter(o => o.tableNo == selectedHistoryTableNo);
    }

    const sortedHistory = filtered.sort((a, b) => {
        const da = new Date(getOrderDate(a));
        const db = new Date(getOrderDate(b));
        return db - da;
    });

    let totalHistoryAmount = 0;
    let rowsHtml = '';

    if (sortedHistory.length === 0) {
        rowsHtml = `
            <tr>
                <td colspan="6" class="text-center text-muted">
                    No completed orders${selectedHistoryTableNo ? ' for Table ' + selectedHistoryTableNo : ''}${selectedHistoryDate ? ' on ' + displayDateFromKey(selectedHistoryDate) : ''}.
                </td>
            </tr>
        `;
    } else {
        sortedHistory.forEach(order => {
            const qty = Number(order.halfPortion) + Number(order.fullPortion);
            const totalPrice = qty * Number(order.price); 
            totalHistoryAmount += totalPrice;

            const displayDate = getOrderDate(order)
                ? new Date(getOrderDate(order)).toLocaleString('en-IN', {
                    hour: '2-digit',
                    minute: '2-digit',
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric',
                    hour12: true
                })
                : 'N/A';

            rowsHtml += `
                <tr class="table-success fade-in-row">
                    <td>${order.customerName || '-'}</td>
                    <td><span class="badge badge-secondary">Table ${order.tableNo}</span></td>
                    <td>${order.itemName}</td>
                    <td><span class="badge badge-info">${qty}</span></td>
                    <td><strong>₹${totalPrice}</strong></td>
                    <td><small class="text-success"><i class="fas fa-check-circle"></i> ${displayDate}</small></td>
                </tr>
            `;
        });
    }

   
    if ($('#orderHistorySection').length === 0) {

        //$('#orderHistoryContainer').html(sectionHtml);

    } else {
        $('#historyTableBody').html(rowsHtml);
        $('.card-footer strong:first').text(`Total Completed Orders: ${sortedHistory.length}`);
        $('.card-footer strong:last').text(`Total Revenue: ₹${totalHistoryAmount}`);
    }

    
    const tableSelect = $('#historyTableFilter');
    const dateSelect = $('#historyDateFilter');
    const currentTables = tableSelect.find('option').length - 1;
    const currentDates = dateSelect.find('option').length - 1;

    if (uniqueTables.length !== currentTables) {
        tableSelect.html(
            `<option value="">All Tables</option>` +
            uniqueTables.map(t => `<option value="${t}" ${selectedHistoryTableNo == t ? 'selected' : ''}>Table ${t}</option>`).join('')
        );
    }

    if (uniqueDateKeys.length !== currentDates) {
        dateSelect.html(
            `<option value="">All Dates</option>` +
            uniqueDateKeys.map(k => `<option value="${k}" ${selectedHistoryDate === k ? 'selected' : ''}>${displayDateFromKey(k)}</option>`).join('')
        );
    }

    // ✅ Rebind filters (once)
    $(document).off('change', '#historyTableFilter').on('change', '#historyTableFilter', function () {
        selectedHistoryTableNo = $(this).val();
        renderOrderHistory();
    });
    $(document).off('change', '#historyDateFilter').on('change', '#historyDateFilter', function () {
        selectedHistoryDate = $(this).val();
        renderOrderHistory();
    });
}



function updateOrderDetails(tableTitle) {
    const data = window.liveOrdersData || [];
    const tableNo = parseInt(tableTitle.replace('Table', ''));
    // FIXED: Filter by tableNo to show only selected table's orders
    let tableOrders = data.filter(order => order.tableNo === tableNo && order.orderStatusId !== 3);

    // Pagination variables
    let currentPage = 1;
    const rowsPerPage = 10;

    function renderTable(filteredOrders) {
        let detailsHtml = `
            <table class="table table-bordered table-striped" id="orderDetailsTable">
                <thead>
                    <tr>
                        <th>Id</th>
                        <th>Item Name</th>
                        <th>Half</th>
                        <th>Full</th>
                        <th>Price</th>
                        <th>Status</th>
                        <th>Order Time</th>
                        <th style="display:none">Update Order</th>
                        <th>Manage Order</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
        `;

        const totalRows = filteredOrders.length;
        const totalPages = Math.ceil(totalRows / rowsPerPage);
        const startIdx = (currentPage - 1) * rowsPerPage;
        const endIdx = Math.min(startIdx + rowsPerPage, totalRows);

        if (totalRows === 0) {
            detailsHtml += `<tr><td colspan="10" class="text-center text-muted">No active orders for Table ${tableNo}.</td></tr>`;
        } else {
            for (let i = startIdx; i < endIdx; i++) {
                const order = filteredOrders[i];
                const qty = Number(order.halfPortion) + Number(order.fullPortion);
                const totalPrice = qty * Number(order.price);

               
                let actionButton = '';
                let isUpdateDisabled = '';
                let isDeleteDisabled = '';
                let rowClass = '';
                let statusText = '';

                if (order.orderStatusId === 1) {
                    
                    actionButton = `<button class="btn btn-success btn-sm accept-order-row-btn" data-id="${order.id}">Accept</button>`;
                    isUpdateDisabled = '';
                    isDeleteDisabled = '';
                    rowClass = 'bg-warning';
                    statusText = 'Assigning Order';
                } else if (order.orderStatusId === 2) {
                    
                    const acceptedTime = orderAcceptedTimes[order.id];              
                    const isOverdue = acceptedTime && (Date.now() - acceptedTime) > 10 * 60 * 1000;

                    if (isOverdue) {
                        actionButton = `<button class="btn btn-danger btn-sm complete-order-row-btn" data-id="${order.id}">Complete (OVERDUE)</button>`;
                        rowClass = 'bg-danger text-white';
                        statusText = 'OVERDUE!';
                    } else {
                        actionButton = `<button class="btn btn-primary btn-sm complete-order-row-btn" data-id="${order.id}">Complete</button>`;
                        rowClass = 'bg-info text-white';
                        statusText = 'Active';
                    }

                    isUpdateDisabled = 'disabled';
                    isDeleteDisabled = 'disabled';
                }

                detailsHtml += `
                    <tr class="${rowClass}">
                        <td>${order.id}</td>
                        <td class="item-name">${order.itemName}</td>
                        <td>${order.halfPortion}</td>
                        <td>${order.fullPortion}</td>
                        <td>₹${totalPrice}</td>
                        <td>${statusText}</td>
                        <td>${order.date ? new Date(order.date).toLocaleString('en-IN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }) : ''}</td>
                        <td style="display:none">
                            <div class="input-group input-group-sm qty-group d-flex flex-row align-items-center" data-id="${order.id}">
                                <button class="btn btn-light qty-dec" type="button" ${isUpdateDisabled}>-</button>
                                <input class="form-control qty-input text-center" value="${order.pendingFullPortion !== undefined ? order.pendingFullPortion : order.fullPortion}" readonly style="min-width:40px; max-width:50px;" ${isUpdateDisabled}>
                                <button class="btn btn-light qty-inc" type="button" ${isUpdateDisabled}>+</button>
                            </div>
                        </td>
                        <td>
                            ${actionButton}
                        </td>
                        <td>
                            <button class="btn btn-danger btn-sm delete-order-btn" data-id="${order.id}" ${isDeleteDisabled}>Delete</button>
                        </td>
                    </tr>
                `;
            }
        }

        detailsHtml += `
                </tbody>
            </table>
        `;

        // Pagination controls
        if (totalPages > 1) {
            detailsHtml += `<nav><ul class="pagination justify-content-end pagination-sm">`;
            detailsHtml += `<li class="page-item${currentPage === 1 ? ' disabled' : ''}"><a class="page-link" href="#" data-page="${currentPage - 1}">Previous</a></li>`;
            for (let p = 1; p <= totalPages; p++) {
                detailsHtml += `<li class="page-item${p === currentPage ? ' active' : ''}"><a class="page-link" href="#" data-page="${p}">${p}</a></li>`;
            }
            detailsHtml += `<li class="page-item${currentPage === totalPages ? ' disabled' : ''}"><a class="page-link" href="#" data-page="${currentPage + 1}">Next</a></li>`;
            detailsHtml += `</ul></nav>`;
        }

        $('#orderDetails').html(detailsHtml);

        // Pagination event handlers
        $(document).off('click', '.pagination .page-link').on('click', '.pagination .page-link', function (e) {
            e.preventDefault();
            const page = parseInt($(this).data('page'));
            if (!isNaN(page) && page > 0 && page <= totalPages) {
                currentPage = page;
                renderTable(filteredOrders);
            }
        });
    }

    renderTable(tableOrders);

    
    $(document).off('click', '.delete-order-btn').on('click', '.delete-order-btn', function () {
        const id = $(this).data('id');
        let order = (window.liveOrdersData || []).find(o => o.id === id);
        if (!order || order.orderStatusId !== 1) return;
        if (confirm('Are you sure you want to delete this order?')) {
            deleteOrder(id);
        }
    });

    
    $(document).off('click', '.qty-dec').on('click', '.qty-dec', function () {
        const group = $(this).closest('.qty-group');
        const id = group.data('id');
        const input = group.find('.qty-input');
        let order = (window.liveOrdersData || []).find(o => o.id === id);
        if (!order || order.orderStatusId !== 1) return;

        const currentValue = order.pendingFullPortion !== undefined ? order.pendingFullPortion : order.fullPortion;
        if (currentValue > 0) {
            order.pendingFullPortion = currentValue - 1;
            input.val(order.pendingFullPortion);
            markOrderAsModified(order);
        }
    });

    $(document).off('click', '.qty-inc').on('click', '.qty-inc', function () {
        const group = $(this).closest('.qty-group');
        const id = group.data('id');
        const input = group.find('.qty-input');
        let order = (window.liveOrdersData || []).find(o => o.id === id);
        if (!order || order.orderStatusId !== 1) return;

        // Store pending changes
        order.pendingFullPortion = (order.pendingFullPortion !== undefined ? order.pendingFullPortion : order.fullPortion) + 1;
        input.val(order.pendingFullPortion);

        
        markOrderAsModified(order);
    });

    
    updateConfirmOrderBtn(parseInt($('.modal-title').text().replace('Table', '')));

}
$(document).on('click', '.accept-order-row-btn', function () {
    const id = $(this).data('id');
    let order = (window.liveOrdersData || []).find(o => o.id === id);
    if (!order || order.orderStatusId !== 1) return;

    if (order.pendingFullPortion !== undefined && order.pendingFullPortion !== order.fullPortion) {
        updateOrderQuantity(order, function () {
            acceptOrder(order, function () {
                updateOrderDetails($('.modal-title').text());
                checkAndStopBeepIfNoProblems();
            });
        });
    } else {
        acceptOrder(order, function () {
            updateOrderDetails($('.modal-title').text());
            checkAndStopBeepIfNoProblems();
        });
    }
});

$(document).off('click', '.complete-order-row-btn').on('click', '.complete-order-row-btn', function () {

    const id = $(this).data('id');
    let order = (window.liveOrdersData || []).find(o => o.id === id);

    if (!order || order.orderStatusId !== 2) {
        alert('Invalid order or order status');
        return;
    }

    // Open payment mode selection modal
    openPaymentModal(id, order);
});

$(document).on('click', '.payment-option', function () {
    $('.payment-option').removeClass('selected');
    $(this).addClass('selected');
    selectedPaymentMode = $(this).data('mode');
    $('#confirmPayment').prop('disabled', false);
    $('#paymentError').removeClass('active');
});

$(document).on('click', '#cancelPayment', function () {
    closePaymentModal();
});

$(document).on('click', '#confirmPayment', function () {
    if (!selectedPaymentMode) {
        $('#paymentError').addClass('active');
        return;
    }

    closePaymentModal();

    if (confirm('Are you sure you want to complete this order?')) {

        let order = (window.liveOrdersData || []).find(o => o.id === currentOrderId);

        if (order) {
            order.paymentMode = selectedPaymentMode;
            completeOrder(order, function () {
                updateOrderDetails($('.modal-title').text());
            });
        } else {
            alert('Order not found');
        }
    }
});

// Close on overlay  click
$(document).on('click', '#paymentModal', function (e) {
    if (e.target.id === 'paymentModal') {
        closePaymentModal();
    }
});
function openPaymentModal(orderId, orderData) {

    currentOrderId = orderId;
    currentOrderData = orderData;
    selectedPaymentMode = null;

    $('.payment-option').removeClass('selected');
    $('#confirmPayment').prop('disabled', true);
    $('#paymentError').removeClass('active');

    $('#paymentModal').addClass('active');
}
function closePaymentModal() {
    $('#paymentModal').removeClass('active');
    selectedPaymentMode = null;
    //currentOrderId = null;
    //currentOrderData = null;
}
// Update order quantity
function updateOrderQuantity(order, callback) {

    stopAllBeeps();

    const payload = {
        id: order.id,
        tableNo: order.tableNo,
        itemName: order.itemName,
        halfPortion: order.halfPortion,
        fullPortion: order.pendingFullPortion,
        price: order.price,
        orderStatusId: order.orderStatusId,
        OrderStatus: order.orderStatusId === 1 ? "Assigning Order" : "Active",
        date: order.date,
        isActive: order.isActive,
        paymentMode: order.paymentMode || null
    };

    $.ajax({
        url: '/home/UpdateOrderItem',
        type: 'POST',
        contentType: 'application/json; charset=utf-8',
        data: JSON.stringify(payload),
        success: function () {
            
            order.fullPortion = order.pendingFullPortion;
            delete order.pendingFullPortion;

            if (callback) callback();
        },
        error: function () {
            showSuccessMessage('Failed to update order quantity!');
        }
    });
}

// Mark order as modified (visual feedback)
function markOrderAsModified(order) {
    const row = `$(.qty-group[data-id="${order.id}"]).closest('tr')`;
    row.addClass('border-primary border-2');
}

// Accept order (change status to Active) - ENHANCED with timing
function acceptOrder(order, callback) {
    

    const payload = {
        id: order.id,
        tableNo: order.tableNo,
        itemName: order.itemName,
        halfPortion: order.halfPortion,
        fullPortion: order.pendingFullPortion !== undefined ? order.pendingFullPortion : order.fullPortion,
        price: order.price,
        orderStatusId: 2,
        OrderStatus: "Active",
        date: order.date,
        isActive: order.isActive,
        orderId: order.orderId
    };

    $.ajax({
        url: '/home/UpdateOrderItem',
        type: 'POST',
        contentType: 'application/json; charset=utf-8',
        data: JSON.stringify(payload),
        success: function () {
            // Update local data
            order.orderStatusId = 2;
            if (order.pendingFullPortion !== undefined) {
                order.fullPortion = order.pendingFullPortion;
                delete order.pendingFullPortion;
            }

            // NEW: Record acceptance time for 10-minute timer
            orderAcceptedTimes[order.id] = Date.now();

            // Clear reminder timer for assigning order
            if (reminderTimers[order.id]) {
                clearTimeout(reminderTimers[order.id]);
                delete reminderTimers[order.id];
            }
            if (orderReceivedTimes[order.id]) {
                delete orderReceivedTimes[order.id];
            }

            // NEW: Set up 10-minute completion timer
            completionTimers[order.id] = setTimeout(function completionReminder() {
                // Check if order is still active
                const stillActive = (window.liveOrdersData || []).some(o => o.id === order.id && o.orderStatusId === 2);
                if (stillActive) {
                    //console.log(Order ${order.id} for Table ${order.tableNo} is overdue (10+ minutes)!);

                    // Start beeping for this table
                    if (!beepTables[order.tableNo]) {
                        try {
                            const audio = new Audio('/sound/alarm.mp3.mp3');
                            audio.loop = true;
                            audio.play().then(() => {
                                beepTables[order.tableNo] = audio;
                            }).catch(err => console.error('Overdue beep error:', err));
                        } catch (err) {
                            console.error('Overdue beep creation error:', err);
                        }
                    }

                    

                    
                    completionTimers[order.id] = setTimeout(completionReminder, 5 * 60 * 1000);
                } else {
                   
                    clearTimeout(completionTimers[order.id]);
                    delete completionTimers[order.id];
                    delete orderAcceptedTimes[order.id];
                }
            }, 10 * 60 * 1000); 

            refreshOrders();
            bindDynamicTable();
            updateStats();

            if (callback) callback();
        },
        error: function () {
            showSuccessMessage('Failed to accept order!');
        }
    });
}


// Complete order (change status to Completed and move to history) - ENHANCED with cleanup
function completeOrder(order, callback) {

    stopBeep();
    const payload = {
        id: order.id,
        tableNo: order.tableNo,
        itemName: order.itemName,
        halfPortion: order.halfPortion,
        fullPortion: order.pendingFullPortion !== undefined ? order.pendingFullPortion : order.fullPortion,
        price: order.price,
        orderStatusId: 3,
        OrderStatus: "Completed Today",
        date: order.date,
        isActive: order.isActive,
        orderId: order.orderId,
        PaymentMode: order.paymentMode
    };

    $.ajax({
        url: '/home/UpdateOrderItem',
        type: 'POST',
        contentType: 'application/json; charset=utf-8',
        data: JSON.stringify(payload),
        success: function () {
            // Move order to history with completion timestamp
            orderHistory.push({
                ...order,
                orderStatusId: 3,
                completedAt: new Date().toISOString(),

            });

            // Remove from live orders
            window.liveOrdersData = window.liveOrdersData.filter(o => o.id !== order.id);

            // NEW: Clean up completion timer and accepted time
            if (completionTimers[order.id]) {
                clearTimeout(completionTimers[order.id]);
                delete completionTimers[order.id];
            }
            if (orderAcceptedTimes[order.id]) {
                delete orderAcceptedTimes[order.id];
            }

            refreshOrders();
            bindDynamicTable();
            updateStats();

            setTimeout(() => {
                checkAndStopBeepIfNoProblems();
            }, 100);

            if (callback) callback();
        },
        error: function () {
            showSuccessMessage('Failed to complete order!');
        }
    });
}

// Refresh DataTable after changes
function refreshOrders() {
    if (liveOrdersTable) {
        liveOrdersTable.clear().rows.add(window.liveOrdersData || []).draw();
    }
}

// Update stats (active, total, new orders)
function updateStats() {
    const data = window.liveOrdersData || [];
    const activeOrders = data.filter(order => order.orderStatusId === 1 || order.orderStatusId === 2).length;
    const completedOrders = orderHistory.length;
    const newOrders = data.filter(order => order.orderStatusId === 1).length;

    $('#activeOrders').text(activeOrders);
    $('#totalOrders').text(completedOrders);
    $('#newOrdersBadge').text(newOrders);
}

// Show a toast message
function showSuccessMessage(message) {
    const toast = $(`
        <div class="alert alert-success alert-dismissible fade show position-fixed" 
             style="top: 100px; right: 20px; z-index: 9999; min-width: 300px;">
            <i class="fas fa-check-circle"></i> ${message}
            <button type="button" class="close" data-dismiss="alert">
                <span>&times;</span>
            </button>
        </div>
    `);

    $('body').append(toast);
    setTimeout(() => {
        toast.alert('close');
    }, 3000);
}

// Delete order by id - ENHANCED with cleanup
function deleteOrder(id) {
    $.ajax({
        url: '/home/SoftDeleteOrder',
        type: 'POST',
        contentType: 'application/json',
        data: JSON.stringify(id),
        success: function () {
            // Remove from local data
            window.liveOrdersData = (window.liveOrdersData || []).filter(order => order.id !== id);

            // Clean up all timers for this order
            if (reminderTimers[id]) {
                clearTimeout(reminderTimers[id]);
                delete reminderTimers[id];
            }
            if (completionTimers[id]) {
                clearTimeout(completionTimers[id]);
                delete completionTimers[id];
            }
            if (orderReceivedTimes[id]) {
                delete orderReceivedTimes[id];
            }
            if (orderAcceptedTimes[id]) {
                delete orderAcceptedTimes[id];
            }

            refreshOrders();
            bindDynamicTable();
            updateStats();
            updateOrderDetails($('.modal-title').text());
            showSuccessMessage('Order deleted successfully!');

            // Check if beep should stop after deletion
            setTimeout(() => {
                checkAndStopBeepIfNoProblems();
            }, 100);
        },
        error: function () {
            showSuccessMessage('Failed to delete order!');
        }
    });
}

function updateConfirmOrderBtn(tableNo) {

    
    const $btn = $('#confirmOrderBtn');
    const data = window.liveOrdersData || [];
    const tableOrders = data.filter(order => order.tableNo === tableNo && order.orderStatusId !== 3);
    const hasAssigning = tableOrders.some(order => order.orderStatusId === 1);
    const hasActive = tableOrders.some(order => order.orderStatusId === 2);

    if (hasAssigning) {
        $btn.text('Accept Order').data('mode', 'accept').removeClass('btn-primary').addClass('btn-success');
    } else if (hasActive) {
        $btn.text('Complete Order').data('mode', 'complete').removeClass('btn-success').addClass('btn-primary');
    } else {
        $btn.text('Accept Order').data('mode', 'accept').removeClass('btn-primary').addClass('btn-success');
    }
}


//  Online orders Section

let isZomatoActive = false;
let isSwiggyActive = false;

$(document).ready(function () {
    // Initialize UI on page load
    initializeConnectionUI();

    // Zomato button click handler
    $('#zomatoBtn').on('click', function () {
        isZomatoActive = !isZomatoActive;
        updateZomatoUI();
    });

    // Swiggy button click handler
    $('#swiggyBtn').on('click', function () {
        isSwiggyActive = !isSwiggyActive;
        updateSwiggyUI();
    });

    // Initialize orders and auto-refresh
    
    startAutoRefresh();
});

function initializeConnectionUI() {
    updateZomatoUI();
    updateSwiggyUI();
}

function updateZomatoUI() {
    if (isZomatoActive) {
        $('#zomatoBtn')
            .removeClass('connect')
            .addClass('disconnect')
            .text('Disconnect Zomato');

        $('#zomatoStatus')
            .text('Connected')
            .removeClass('disconnected sync-offline')
            .addClass('connected sync-online');
    } else {
        $('#zomatoBtn')
            .removeClass('disconnect')
            .addClass('connect')
            .text('Connect Zomato');

        $('#zomatoStatus')
            .text('Disconnected')
            .removeClass('connected sync-online')
            .addClass('disconnected sync-offline');
    }
}

function updateSwiggyUI() {
    if (isSwiggyActive) {
        $('#swiggyBtn')
            .removeClass('connect')
            .addClass('disconnect')
            .text('Disconnect Swiggy');

        $('#swiggyStatus')
            .text('Connected')
            .removeClass('disconnected sync-offline')
            .addClass('connected sync-online');
    } else {
        $('#swiggyBtn')
            .removeClass('disconnect')
            .addClass('connect')
            .text('Connect Swiggy');

        $('#swiggyStatus')
            .text('Disconnected')
            .removeClass('connected sync-online')
            .addClass('disconnected sync-offline');
    }
}

//FIXED: Use consistent property name 'orderId' instead of 'id'
let ordersData = [];

let currentFilter = 'all';

function renderOrders() {
    const container = $('#ordersContainer');
    container.empty();

    // Filter orders based on selected platform
    const filteredOrders = currentFilter === 'all' ?
        ordersData : ordersData.filter(order => order.platform === currentFilter);

    // Create and append order cards
    filteredOrders.forEach(order => {
        const orderCard = createOrderCard(order);
        container.append(orderCard);
    });
}

// CREATE ORDER CARD FUNCTION - Generates HTML for each order
function createOrderCard(order) {
    const platformClass = order.platform;
    const badgeClass = `badge-${order.platform}`;
    const statusClass = `status-${order.status}`;

    return `
        <div class="order-card ${platformClass}">
            <div class="order-header">
                <div class="order-id">#${order.orderId}</div>
                <span class="platform-badge ${badgeClass}">
                    ${order.platform.toUpperCase()}
                </span>
            </div>
            <div class="order-info mb-3">
                <div><strong>Customer:</strong> ${order.customer}</div>
                <div><strong>Phone:</strong> ${order.phone}</div>
                <div><strong>Delivery Time:</strong> ${order.deliveryTime}</div>
                <div><strong>Platform:</strong> ${order.platform.charAt(0).toUpperCase() + order.platform.slice(1)}</div>
            </div>
            <div class="order-items">
                ${order.items.map(item => `
                    <div class="order-item">
                        <span>${item.name} x${item.quantity}</span>
                        <span>₹${item.price}</span>
                    </div>
                `).join('')}
            </div>
            <div class="order-footer">
                <div class="order-total">₹${order.total}</div>
                <span class="status-badge ${statusClass}">${order.status ? order.status.toUpperCase() : 'PENDING'}</span>
            </div>
            <div class="action-buttons">
                <button class="btn btn-primary btn-action" onclick="viewOrderDetails('${order.orderId}')">
                    <i class="fas fa-eye"></i> View
                </button>
                
                ${/* COFFEE ORDER BUTTONS */ ''}
                ${order.platform === 'coffee' ? `
                    ${order.status === 'new' ? `
                        <button class="btn btn-success btn-action" onclick="acceptCoffeeOrder('${order.orderId}')">
                            <i class="fas fa-check"></i> Accept
                        </button>
                        <button class="btn btn-danger btn-action" onclick="rejectOrder('${order.orderId}')">
                            <i class="fas fa-times"></i> Reject
                        </button>
                    ` : ''}
                    ${order.status === 'confirmed' ? `
                        <button class="btn btn-info btn-action" onclick="deliverCoffeeOrder('${order.orderId}')">
                            <i class="fas fa-coffee"></i> Mark Delivered
                        </button>
                    ` : ''}
                    ${order.status === 'completed' ? `
                        <span class="text-success font-weight-bold">
                            <i class="fas fa-check-double"></i> Delivered
                        </span>
                    ` : ''}
                ` : ''}
                
                ${/* REGULAR RESTAURANT ORDERS */ ''}
                ${order.platform === 'restaurant' || order.platform === 'online' ? `
                    ${order.status === 'new' ? `
                        <button class="btn btn-success btn-action" onclick="updateOrderStatus('${order.orderId}', 'confirmed')">
                            <i class="fas fa-check"></i> Accept
                        </button>
                        <button class="btn btn-danger btn-action" onclick="rejectOrder('${order.orderId}')">
                            <i class="fas fa-times"></i> Reject
                        </button>
                    ` : ''}
                    ${order.status === 'confirmed' ? `
                        <button class="btn btn-warning btn-action" onclick="updateOrderStatus('${order.orderId}', 'preparing')">
                            <i class="fas fa-utensils"></i> Preparing
                        </button>
                    ` : ''}
                    ${order.status === 'preparing' ? `
                        <button class="btn btn-info btn-action" onclick="updateOrderStatus('${order.orderId}', 'ready')">
                            <i class="fas fa-check-circle"></i> Ready
                        </button>
                    ` : ''}
                    ${order.status === 'ready' ? `
                        <button class="btn btn-success btn-action" onclick="updateOrderStatus('${order.orderId}', 'completed')">
                            <i class="fas fa-shipping-fast"></i> Mark Delivered
                        </button>
                    ` : ''}
                    ${order.status === 'completed' ? `
                        <span class="text-success font-weight-bold">
                            <i class="fas fa-check-double"></i> Completed
                        </span>
                    ` : ''}
                ` : ''}
                
                ${/* ZOMATO/SWIGGY ORDERS */ ''}
                ${order.platform === 'zomato' || order.platform === 'swiggy' ? `
                    ${order.status === 'new' ? `
                        <button class="btn btn-success btn-action" onclick="updateOrderStatus('${order.orderId}', 'confirmed')">
                            <i class="fas fa-check"></i> Accept
                        </button>
                        <button class="btn btn-danger btn-action" onclick="rejectOrder('${order.orderId}')">
                            <i class="fas fa-times"></i> Reject
                        </button>
                    ` : ''}
                    ${order.status === 'confirmed' ? `
                        <button class="btn btn-warning btn-action" onclick="updateOrderStatus('${order.orderId}', 'preparing')">
                            <i class="fas fa-utensils"></i> Preparing
                        </button>
                    ` : ''}
                    ${order.status === 'preparing' ? `
                        <button class="btn btn-info btn-action" onclick="updateOrderStatus('${order.orderId}', 'ready')">
                            <i class="fas fa-check-circle"></i> Ready
                        </button>
                    ` : ''}
                    ${order.status === 'ready' ? `
                        <button class="btn btn-success btn-action" onclick="updateOrderStatus('${order.orderId}', 'completed')">
                            <i class="fas fa-shipping-fast"></i> Mark Delivered
                        </button>
                    ` : ''}
                    ${order.status === 'completed' ? `
                        <span class="text-success font-weight-bold">
                            <i class="fas fa-check-double"></i> Completed
                        </span>
                    ` : ''}
                ` : ''}
            </div>
        </div>
    `;
}

// FILTER ORDERS FUNCTION
function filterOrders(platform) {
    currentFilter = platform;

    $('.platform-tab').removeClass('active');
    $(`.platform-tab[data-platform="${platform}"]`).addClass('active');

    renderOrders();
}

// UPDATE ORDER STATUS FUNCTION (SINGLE UNIFIED VERSION)
function updateOrderStatus(orderId, newStatus) {


    const orderIndex = ordersData.findIndex(o => o.orderId === orderId);
    if (orderIndex !== -1) {
        ordersData[orderIndex].status = newStatus;

        // Re-render orders
        renderOrders();
        updateNewOrdersBadge();

        showNotification(`Order #${orderId} updated to ${newStatus}`, 'success');

        // Update on respective platform
        updateOrderStatusOnPlatform(orderId, newStatus, ordersData[orderIndex].platform);
    }
}

// VIEW ORDER DETAILS FUNCTION
function viewOrderDetails(orderId) {
    stopBeep();
    stopAllTableBeeps();
    const order = ordersData.find(o => o.orderId === orderId);
    if (!order) return;

    // Update modal title
    //$('.modal-title').first().html(`Order #${order.orderId} ${order.platform.toUpperCase()}</span>`);

    const content = `
        <div class="row">
            <div class="col-md-6">
                <h6>Customer Information</h6>
                <p><strong>Name:</strong> ${order.customer}</p>
                <p><strong>Phone:</strong> ${order.phone}</p>
                <p><strong>Address:</strong> ${order.address}</p>
                <p><strong>Delivery Time:</strong> ${order.deliveryTime}</p>
                <p><strong>Status:</strong> <span class="status-badge status-${order.status}">${order.status.toUpperCase()}</span></p>
                <p><strong>Order Time:</strong> ${order.timestamp.toLocaleString()}</p>
            </div>
            <div class="col-md-6">
                <h6>Order Details</h6>
                <div class="table-responsive">
                    <table class="table table-sm">
                        <thead>
                            <tr>
                                <th>Item</th>
                                <th>Qty</th>
                                <th>Price</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${order.items.map(item => `
                                <tr>
                                    <td>${item.name}</td>
                                    <td>${item.quantity}</td>
                                    <td>₹${item.price}</td>
                                </tr>
                            `).join('')}
                            <tr class="font-weight-bold">
                                <td colspan="2">Total</td>
                                <td>₹${order.total}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    `;

    $('#orderDetails').html(content);
    $('#divInProgressModal').modal('show');
}

// UPDATE NEW ORDERS BADGE
function updateNewOrdersBadge() {
    const newOrdersCount = ordersData.filter(order => order.status === 'new').length;
    $('#newOrdersBadge').text(newOrdersCount);
}

// GET ORDERS FROM ZOMATO
//function getOrdersFromZomato() {
//    if (!isZomatoActive) {
//        console.log('Zomato is disconnected. No new orders will be fetched.');
//        return;
//    }

//    $.ajax({
//        url: '/api/zomato/orders',
//        method: 'GET',
//        headers: {
//            'Authorization': 'Bearer YOUR_ZOMATO_API_KEY',
//            'Content-Type': 'application/json'
//        },
//        success: function (data) {
//            console.log('Zomato orders fetched successfully');

//            const zomatoOrders = data.map(order => ({
//                orderId: order.zomato_order_id,
//                platform: 'zomato',
//                customer: order.customer_name,
//                phone: order.customer_phone,
//                items: order.items.map(item => ({
//                    name: item.dish_name,
//                    quantity: item.quantity,
//                    price: item.price
//                })),
//                total: order.total_amount,
//                status: mapZomatoStatus(order.status),
//                timestamp: new Date(order.created_at),
//                deliveryTime: order.estimated_delivery_time
//            }));

//            const existingIds = ordersData.map(order => order.orderId);
//            const newOrders = zomatoOrders.filter(order => !existingIds.includes(order.orderId));

//            ordersData = [...newOrders, ...ordersData];
//            renderOrders();
//            updateNewOrdersBadge();

//            if (newOrders.length > 0) {
//                showNotification(`${newOrders.length} new Zomato orders received!`, 'success');
//            }
//        },
//        error: function (xhr, status, error) {
//            console.error('Zomato API Error:', error);
//            showNotification('Failed to fetch Zomato orders', 'error');
//            $('#zomatoStatus').removeClass('sync-online').addClass('sync-offline');
//        }
//    });
//}

// GET ORDERS FROM SWIGGY
//function getOrdersFromSwiggy() {
//    if (!isSwiggyActive) {
//        console.log('Swiggy is disconnected. No new orders will be fetched.');
//        return;
//    }

//    $.ajax({
//        url: '/api/swiggy/orders',
//        method: 'GET',
//        headers: {
//            'Authorization': 'Bearer YOUR_SWIGGY_API_KEY',
//            'Content-Type': 'application/json'
//        },
//        success: function (data) {
//            console.log('Swiggy orders fetched successfully');

//            const swiggyOrders = data.orders.map(order => ({
//                orderId: order.order_id,
//                platform: 'swiggy',
//                customer: order.customer_details.name,
//                phone: order.customer_details.phone,
//                items: order.order_items.map(item => ({
//                    name: item.item_name,
//                    quantity: item.quantity,
//                    price: item.item_price
//                })),
//                total: order.order_total,
//                status: mapSwiggyStatus(order.order_status),
//                timestamp: new Date(order.order_time),
//                deliveryTime: order.delivery_time_estimate
//            }));

//            const existingIds = ordersData.map(order => order.orderId);
//            const newOrders = swiggyOrders.filter(order => !existingIds.includes(order.orderId));

//            ordersData = [...newOrders, ...ordersData];
//            renderOrders();
//            updateNewOrdersBadge();

//            if (newOrders.length > 0) {
//                showNotification(`${newOrders.length} new Swiggy orders received!`, 'success');
//            }
//        },
//        error: function (xhr, status, error) {
//            console.error('Swiggy API Error:', error);
//            showNotification('Failed to fetch Swiggy orders', 'error');
//            $('#swiggyStatus').removeClass('sync-online').addClass('sync-offline');
//        }
//    });
//}

// REFRESH ALL PLATFORMS
function refreshAllPlatforms() {
    $('#zomatoStatus').removeClass('sync-offline').addClass('sync-online');
    $('#swiggyStatus').removeClass('sync-offline').addClass('sync-online');
    $('#coffeeStatus').removeClass('sync-offline').addClass('sync-online');

    //getOrdersFromZomato();
    //getOrdersFromSwiggy();
    //getOrdersFromCoffee();
}

// UPDATE ORDER STATUS ON PLATFORM
function updateOrderStatusOnPlatform(orderId, status, platform) {

    if (platform === 'zomato') {
        updateZomatoOrderStatus(orderId, status);
    } else if (platform === 'swiggy') {
        updateSwiggyOrderStatus(orderId, status);
    } else if (platform === 'Online' || platform === 'restaurant') {
        updateRestaurantOrderStatus(orderId, status);
    }
}

// UPDATE ZOMATO ORDER STATUS
function updateZomatoOrderStatus(orderId, status) {
    $.ajax({
        url: '/home/UpdateOrderItem',
        method: 'PUT',
        headers: {
            'Authorization': 'Bearer YOUR_ZOMATO_API_KEY',
            'Content-Type': 'application/json'
        },
        data: JSON.stringify({
            status: mapToZomatoStatus(status)
        }),
        success: function (data) {
            console.log('Zomato order status updated successfully');
            showNotification(`Zomato order #${orderId} status updated`, 'success');
        },
        error: function (xhr, status, error) {
            console.error('Failed to update Zomato order status:', error);
            showNotification(`Failed to update Zomato order #${orderId}`, 'error');
        }
    });
}

// UPDATE SWIGGY ORDER STATUS
function updateSwiggyOrderStatus(orderId, status) {
    $.ajax({
        url: `/api/swiggy/orders/${orderId}/status`,
        method: 'PUT',
        headers: {
            'Authorization': 'Bearer YOUR_SWIGGY_API_KEY',
            'Content-Type': 'application/json'
        },
        data: JSON.stringify({
            order_status: mapToSwiggyStatus(status)
        }),
        success: function (data) {
            console.log('Swiggy order status updated successfully');
            showNotification(`Swiggy order #${orderId} status updated`, 'success');
        },
        error: function (xhr, status, error) {
            console.error('Failed to update Swiggy order status:', error);
            showNotification(`Failed to update Swiggy order #${orderId}`, 'error');
        }
    });
}

// UPDATE RESTAURANT ORDER STATUS
function updateRestaurantOrderStatus(orderId, status) {
    stopBeep();
    stopAllBeeps();

    const statusMap = {
        'Active': 2,
        'Completed Today': 3,
        'ready': 4,
        'completed': 5
    };

    // compute numericStatus first
    const numericStatus = statusMap[status] ?? null;

    // use exact property names that match your UpdateonlineOrder JSON names
    const payload = {
        orderId: String(orderId),
        orderStatus: numericStatus
    };

    // debug: verify payload sent
    console.log('UpdateOnlineStatus payload:', payload);

    $.ajax({
        url: '/Home/UpdateOnlineStatus',
        type: 'PUT',
        contentType: 'application/json; charset=utf-8',
        data: JSON.stringify(payload),
        success: function (data) {
            console.log('Restaurant order status updated successfully');

            const messages = {
                'Active': 'Order accepted and confirmed',
                'Completed Today': 'Order is now being prepared',
                'ready': 'Order is ready for pickup/delivery',
                'completed': 'Order has been delivered successfully'
            };
            showNotification(messages[status] || 'Order updated', 'success');
        },
        error: function (xhr, statusText, error) {
            console.error('Failed to update restaurant order status:', statusText, error);
            showNotification(`Failed to update order #${orderId}`, 'error');
        }
    });
}

// REJECT ORDER FUNCTION
function rejectOrder(orderId) {
    if (!confirm('Are you sure you want to reject this order?')) {
        return;
    }

    const orderIndex = ordersData.findIndex(o => o.orderId === orderId);
    if (orderIndex !== -1) {
        // Remove from orders array
        const order = ordersData[orderIndex];
        ordersData.splice(orderIndex, 1);


        // Re-render
        renderOrders();
        updateNewOrdersBadge();

        showNotification(`Order #${orderId} has been rejected`, 'warning');

        // Notify backend
        $.ajax({
            url: `/api/restaurant/orders/${orderId}/reject`,
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            data: JSON.stringify({
                status: 'rejected',
                platform: order.platform
            }),
            success: function (data) {
                console.log('Order rejection confirmed on backend');
            },
            error: function (xhr, status, error) {
                console.error('Failed to reject order on backend:', error);
            }
        });
    }
}

// STATUS MAPPING FUNCTIONS
function mapZomatoStatus(zomatoStatus) {
    const statusMap = {
        'placed': 'new',
        'accepted': 'confirmed',
        'cooking': 'preparing',
        'ready': 'ready',
        'dispatched': 'completed'
    };
    return statusMap[zomatoStatus] || 'new';
}

function mapSwiggyStatus(swiggyStatus) {
    const statusMap = {
        'ORDER_PLACED': 'new',
        'RESTAURANT_ACCEPTED': 'confirmed',
        'FOOD_PREPARATION': 'preparing',
        'READY_FOR_PICKUP': 'ready',
        'ORDER_DISPATCHED': 'completed'
    };
    return statusMap[swiggyStatus] || 'new';
}

function mapToZomatoStatus(internalStatus) {
    const statusMap = {
        'new': 'placed',
        'confirmed': 'accepted',
        'preparing': 'cooking',
        'ready': 'ready',
        'completed': 'dispatched'
    };
    return statusMap[internalStatus] || 'placed';
}

function mapToSwiggyStatus(internalStatus) {
    const statusMap = {
        'new': 'ORDER_PLACED',
        'confirmed': 'RESTAURANT_ACCEPTED',
        'preparing': 'FOOD_PREPARATION',
        'ready': 'READY_FOR_PICKUP',
        'completed': 'ORDER_DISPATCHED'
    };
    return statusMap[internalStatus] || 'ORDER_PLACED';
}

// AUTO REFRESH
function startAutoRefresh() {
    setInterval(() => {
        refreshAllPlatforms();

        // Simulate new orders randomly (for demo)
        if (Math.random() > 0.8) {
            const platforms = [];

            if (isZomatoActive) platforms.push('zomato');
            if (isSwiggyActive) platforms.push('swiggy');

            if (platforms.length === 0) {
                console.log('Both platforms are disconnected. No dummy orders will be generated.');
                return;
            }

            const randomPlatform = platforms[Math.floor(Math.random() * platforms.length)];

            const newOrder = {
                orderId: randomPlatform.toUpperCase() + Date.now(),
                platform: randomPlatform,
                customer: "New Customer",
                phone: "+91 " + Math.floor(Math.random() * 9000000000 + 1000000000),
                items: [
                    { name: "Sample Item", quantity: 1, price: Math.floor(Math.random() * 300 + 100) }
                ],
                total: Math.floor(Math.random() * 500 + 200),
                status: "new",
                timestamp: new Date(),
                deliveryTime: Math.floor(Math.random() * 30 + 15) + " min"
            };

            ordersData.unshift(newOrder);
            renderOrders();
            updateNewOrdersBadge();
            showNotification(`New ${randomPlatform} order received!`, 'info');
        }
    }, 30000);
}

// SHOW NOTIFICATION
function showNotification(message, type) {
    const alertClass = type === 'success' ? 'alert-success' :
        type === 'info' ? 'alert-info' :
            type === 'error' ? 'alert-danger' : 'alert-warning';

    const notification = `
        <div class="alert ${alertClass} alert-dismissible fade show position-fixed" 
             style="top: 20px; right: 20px; z-index: 9999; min-width: 300px;">
            ${message}
            <button type="button" class="close" data-dismiss="alert">
                <span>&times;</span>
            </button>
        </div>
    `;

    $('body').append(notification);

    setTimeout(() => {
        $('.alert').fadeOut();
    }, 3000);
}

// GET ORDERS FROM RESTAURANT
function getOrdersFromRestaurant() {

    $.ajax({
        url: '/home/GetOrderOnline',
        method: 'GET',
        headers: {
            'Content-Type': 'application/json'
        },
        success: function (data) {
            //console.log('Restaurant orders fetched successfully');

            // Group orders by orderId
            const groupedOrders = data.reduce((acc, order) => {
                const orderKey = order.orderId;

                if (!acc[orderKey]) {
                    acc[orderKey] = {
                        orderId: order.orderId,
                        platform: order.orderType || 'online',
                        customer: order.customerName || 'Walk-in Customer',
                        phone: order.phone || 'N/A',
                        items: [],
                        total: 0,
                        status: order.orderStatus || 'new',
                        timestamp: new Date(order.date),
                        deliveryTime: order.prep_time || '15 min',
                        address: order.address
                    };
                }

                // Add each item
                acc[orderKey].items.push({
                    name: order.itemName,
                    quantity: order.halfPortion || order.fullPortion || 1,
                    price: order.price
                });

                // Calculate total
                const itemTotal = (order.fullPortion || 0) * order.price + (order.halfPortion || 0) * order.price;
                acc[orderKey].total += itemTotal;

                return acc;
            }, {});

            const restaurantOrders = Object.values(groupedOrders);

            // Merge with existing data
            const existingOrderIds = ordersData.map(order => order.orderId);
            const newOrders = restaurantOrders.filter(order => !existingOrderIds.includes(order.orderId));

            ordersData = [...newOrders, ...ordersData];

            renderOrders();
            updateNewOrdersBadge();

            if (newOrders.length > 0) {
                showNotification(`${newOrders.length} new restaurant orders received!`, 'success');
            }
        },
        error: function (xhr, status, error) {
            //console.error('Failed to fetch restaurant orders:', error);
            //showNotification('Failed to fetch restaurant orders', 'error');
        }
    });
}

// Export functions for global access
window.restaurantDashboard = {
    viewOrderDetails,
    updateOrderStatus,
    //getOrdersFromCoffee();
    filterOrders,
    rejectOrder,
    acceptCoffeeOrder,
    deliverCoffeeOrder,
    updateCoffeeOrderStatus
};


function getOrdersFromCoffee() {
    $.ajax({
        url: '/Home/GetCoffeeOrders',
        method: 'GET',
        headers: {
            'Content-Type': 'application/json'
        },
        success: function (data) {


            const coffeeOrders = data.map(order => ({
                orderId: order.orderNumber,
                platform: 'coffee',
                customer: order.customerName || 'Walk-in Customer',
                phone: order.customerPhone || 'N/A',
                items: [{
                    name: order.coffeeName,
                    quantity: order.quantity,
                    price: order.price,
                    description: order.description
                }],
                total: order.totalPrice,
                status: 'new',
                timestamp: new Date(order.orderDate),
                deliveryTime: '5-10 min',
                address: 'Pickup'
            }));

            const existingOrderIds = ordersData.map(order => order.orderId);
            const newOrders = coffeeOrders.filter(order => !existingOrderIds.includes(order.orderId));

            ordersData = [...newOrders, ...ordersData];
            renderOrders();
            updateNewOrdersBadge();

            if (newOrders.length > 0) {
                showNotification(`${newOrders.length} new coffee orders received!`, 'success');
            }
        },
        error: function (xhr, status, error) {
            console.error('Failed to fetch coffee orders:', error);
            showNotification('Failed to fetch coffee orders', 'error');
        }
    });
}


// Coffee Orders section 


function updateCoffeeOrderStatus(orderId, newStatus) {
    console.log(`Updating coffee order ${orderId} to status: ${newStatus}`);

    const orderIndex = ordersData.findIndex(o => o.orderId === orderId);
    if (orderIndex === -1) {
        showNotification(`Order #${orderId} not found`, 'error');
        return;
    }

    const order = ordersData[orderIndex];


    const statusMap = {
        'confirmed': 'Accepted',
        'completed': 'Delivered'
    };

    const apiStatus = statusMap[newStatus];

    if (!apiStatus) {
        showNotification('Invalid status', 'error');
        return;
    }


    const payload = {
        orderId: orderId,
        status: apiStatus
    };


    $.ajax({
        url: '/Home/UpdateCoffeeOrderStatus',
        method: 'POST',
        contentType: 'application/json; charset=utf-8',
        data: JSON.stringify(payload),
        success: function (response) {



            ordersData[orderIndex].status = newStatus;


            renderOrders();
            updateNewOrdersBadge();


            const messages = {
                'confirmed': ' Order accepted successfully',
                'completed': ' Order delivered successfully'
            };
            showNotification(messages[newStatus], 'success');


            if (newStatus === 'completed') {
                setTimeout(() => {
                    ordersData.splice(orderIndex, 1);
                    renderOrders();
                    updateNewOrdersBadge();
                }, 2000);
            }
        },
        error: function (xhr, status, error) {

            showNotification(`Failed to update order #${orderId}`, 'error');
        }
    });
}

// Accept Coffee Order (wrapper function)
function acceptCoffeeOrder(orderId) {
    if (!confirm('Accept this coffee order?')) {
        return;
    }
    updateCoffeeOrderStatus(orderId, 'confirmed');
}

// Deliver Coffee Order (wrapper function)
function deliverCoffeeOrder(orderId) {
    if (!confirm('Mark this coffee order as delivered?')) {
        return;
    }
    updateCoffeeOrderStatus(orderId, 'completed');
}


$(document).on('click', '#btnViewHistory', function () {
    $('#orderHistoryModal').modal('show');
    $('#orderHistoryContainer').html(`
      <div class="text-center p-4 text-muted">
          <i class="fas fa-spinner fa-spin"></i> Fetching order history...
      </div>
  `);
    setTimeout(() => {
        renderOrderHistory();
    }, 300);
});

//$(document).ready(function () {

//    // Auto refresh every 30 seconds
//    //setInterval(function () {
//    //    getOrdersFromCoffee(false);
//    //}, 30000);


//});