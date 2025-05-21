<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="description" content="Track your brewery visits and ratings across Maryland, Pennsylvania, and Virginia">
    <title>Brewery Tracker</title>
    <link rel="stylesheet" href="css/styles.css">
    <link rel="stylesheet" href="https://unpkg.com/leaflet@1.7.1/dist/leaflet.css" />
</head>
<body>
    <header class="bg-beer-dark text-white p-4">
        <div class="container mx-auto flex justify-between items-center">
            <h1 class="text-xl font-bold">Brewery Tracker</h1>
            <div class="flex items-center space-x-2">
                <button id="currentLocationButton" aria-label="Find my location" class="p-2 rounded bg-beer-light text-beer-dark">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 8c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4-1.79-4-4-4zm8.94 3A8.994 8.994 0 0 0 13 3.06V1h-2v2.06A8.994 8.994 0 0 0 3.06 11H1v2h2.06A8.994 8.994 0 0 0 11 20.94V23h2v-2.06A8.994 8.994 0 0 0 20.94 13H23v-2h-2.06zM12 19c-3.87 0-7-3.13-7-7s3.13-7 7-7 7 3.13 7 7-3.13 7-7 7z"/>
                    </svg>
                </button>
                <button id="addBreweryButton" aria-label="Add new brewery" class="px-3 py-1 bg-white text-beer-dark rounded shadow hover:bg-gray-100">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 inline-block" viewBox="0 0 20 20" fill="currentColor">
                        <path fill-rule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clip-rule="evenodd" />
                    </svg>
                    Add
                </button>
                <button id="statsButton" aria-label="View statistics" class="px-3 py-1 bg-white text-beer-dark rounded shadow hover:bg-gray-100">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 inline-block" viewBox="0 0 20 20" fill="currentColor">
                        <path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z" />
                    </svg>
                    Stats
                </button>
                <div class="relative">
                    <button id="syncButton" aria-label="Sync data" class="px-3 py-1 bg-white text-beer-dark rounded shadow hover:bg-gray-100">
                        <div id="syncStatus" class="absolute w-2 h-2 rounded-full bg-gray-400 top-0 right-0"></div>
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 inline-block" viewBox="0 0 20 20" fill="currentColor">
                            <path fill-rule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clip-rule="evenodd" />
                        </svg>
                        Sync
                    </button>
                    <div id="syncDropdown" class="hidden absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg z-10">
                        <div class="p-2 border-b">
                            <div class="flex items-center justify-between">
                                <label for="autoSync" class="text-sm">Auto Sync</label>
                                <input type="checkbox" id="autoSync" class="form-checkbox h-4 w-4 text-primary">
                            </div>
                            <p id="lastSyncTime" class="text-xs text-gray-500 mt-1">Last synced: Never</p>
                        </div>
                        <div class="p-2">
                            <button id="manualSync" class="w-full text-left text-sm py-1 hover:text-primary">Sync Now</button>
                            <button id="exportData" class="w-full text-left text-sm py-1 hover:text-primary">Export Data</button>
                            <button id="importData" class="w-full text-left text-sm py-1 hover:text-primary">Import Data</button>
                            <input type="file" id="fileInput" class="hidden" accept=".json">
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </header>

    <div class="bg-gray-100 dark:bg-gray-800 p-2 md:hidden flex justify-center">
        <div class="inline-flex rounded-md shadow-sm" role="group" aria-label="View toggle">
            <button id="showMapBtn" class="px-4 py-2 text-sm font-medium bg-primary text-white rounded-l-lg" type="button" aria-pressed="true">
                Map
            </button>
            <button id="showListBtn" class="px-4 py-2 text-sm font-medium bg-white dark:bg-gray-700 text-gray-700 dark:text-white rounded-r-lg" type="button" aria-pressed="false">
                List
            </button>
        </div>
    </div>

    <main class="flex flex-col md:flex-row h-[calc(100vh-4rem)]">
        <section class="md:w-1/3 p-4 overflow-y-auto">
            <div class="mb-4">
                <input type="text" id="searchInput" placeholder="Search breweries..." class="w-full p-2 border rounded">
            </div>
            <div class="grid grid-cols-2 gap-2 mb-4">
                <select id="stateFilter" class="p-2 border rounded">
                    <option value="all">All States</option>
                    <option value="MD">Maryland</option>
                    <option value="PA">Pennsylvania</option>
                    <option value="VA">Virginia</option>
                </select>
                <select id="visitedFilter" class="p-2 border rounded">
                    <option value="all">All Breweries</option>
                    <option value="visited">Visited</option>
                    <option value="notVisited">Not Visited</option>
                </select>
                <select id="ratingFilter" class="p-2 border rounded">
                    <option value="">All Ratings</option>
                    <option value="0">Not Rated</option>
                    <option value="4">4+ Stars</option>
                    <option value="4.5">4.5+ Stars</option>
                </select>
            </div>
            <div id="breweryList" class="space-y-3">
                <!-- Brewery items will be loaded here -->
            </div>
        </section>

        <section id="mapContainer" class="flex-1 h-1/2 md:h-full">
            <div id="map" class="h-full"></div>
        </section>
    </main>

    <!-- Modals -->
    <div id="detailsModal" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center hidden z-50">
        <div class="bg-white dark:bg-gray-800 rounded-lg shadow-lg max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div class="p-4 border-b">
                <div class="flex justify-between items-center">
                    <h2 id="modalTitle" class="text-xl font-bold">Brewery Name</h2>
                    <button id="closeModal" class="text-gray-500 hover:text-gray-700">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>
            </div>
            <div class="p-4">
                <p id="modalRank" class="mb-2">Rank: #1</p>
                <p id="modalLocation" class="mb-2">Location: City, State</p>
                <p id="modalAddress" class="mb-2 cursor-pointer text-blue-500 hover:underline">Address: 123 Main St</p>
                
                <div class="mb-4">
                    <h3 class="font-bold mb-1">Flagship Beers:</h3>
                    <div id="modalFlagshipBeer">Loading...</div>
                </div>
                
                <div class="mb-4">
                    <label class="flex items-center">
                        <input type="checkbox" id="visitedCheckbox" class="form-checkbox h-4 w-4 text-primary">
                        <span class="ml-2">Visited</span>
                    </label>
                    <div id="visitDateContainer" class="mt-2 hidden">
                        <label for="visitDate" class="block text-sm">Visit Date:</label>
                        <input type="date" id="visitDate" class="mt-1 p-2 border rounded w-full">
                    </div>
                </div>
                
                <div class="mb-4">
                    <h3 class="font-bold mb-2">Ratings:</h3>
                    <div class="grid grid-cols-3 gap-4">
                        <div>
                            <p class="text-sm mb-1">KC:</p>
                            <div id="kcRating" class="flex"></div>
                        </div>
                        <div>
                            <p class="text-sm mb-1">Jeff:</p>
                            <div id="jeffRating" class="flex"></div>
                        </div>
                        <div>
                            <p class="text-sm mb-1">Dave:</p>
                            <div id="daveRating" class="flex"></div>
                        </div>
                    </div>
                    <p class="mt-2">Average: <span id="avgRating">Not rated</span></p>
                </div>
                
                <div class="mb-4">
                    <label for="breweryNotes" class="block font-bold mb-1">Notes:</label>
                    <textarea id="breweryNotes" class="w-full p-2 border rounded" rows="3"></textarea>
                </div>
                
                <div class="mb-4">
                    <label for="untappdURL" class="block font-bold mb-1">Untappd URL:</label>
                    <div class="flex">
                        <input type="text" id="untappdURL" class="flex-1 p-2 border rounded-l" placeholder="https://untappd.com/...">
                        <button id="testUntappdLink" class="bg-gray-200 px-2 py-1 rounded-r border border-l-0">Test</button>
                    </div>
                    <div class="flex mt-2">
                        <a id="untappdLink" href="#" target="_blank" class="text-blue-500 hover:underline text-sm mr-2">Open in Untappd</a>
                        <button id="fixCommonUntappdErrors" class="text-sm text-gray-500 hover:text-gray-700">Fix common errors</button>
                    </div>
                </div>
                
                <div class="flex justify-end">
                    <button id="saveBrewery" class="px-4 py-2 bg-primary text-white rounded hover:bg-opacity-90">Save</button>
                </div>
            </div>
        </div>
    </div>

    <div id="statsModal" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center hidden z-50">
        <div class="bg-white dark:bg-gray-800 rounded-lg shadow-lg max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div class="p-4 border-b">
                <div class="flex justify-between items-center">
                    <h2 class="text-xl font-bold">Brewery Statistics</h2>
                    <button id="closeStatsModal" class="text-gray-500 hover:text-gray-700">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>
            </div>
            <div class="p-4">
                <div class="mb-4">
                    <h3 class="font-bold mb-2">Progress</h3>
                    <div class="w-full bg-gray-200 rounded-full h-2.5">
                        <div id="progressBar" class="bg-primary h-2.5 rounded-full" style="width: 0%"></div>
                    </div>
                    <p id="progressText" class="text-sm mt-1">0 of 0 breweries visited (0%)</p>
                </div>
                
                <div class="mb-4">
                    <h3 class="font-bold mb-2">Average Rating</h3>
                    <p id="avgOverallRating">No ratings yet</p>
                </div>
                
                <div class="mb-4">
                    <h3 class="font-bold mb-2">Top Rated Breweries</h3>
                    <ul id="topRatedList" class="list-none space-y-1">
                        <li class="text-gray-500 italic">No rated breweries yet</li>
                    </ul>
                </div>
                
                <div class="mb-4">
                    <h3 class="font-bold mb-2">Recent Visits</h3>
                    <ul id="recentVisitsList" class="list-none space-y-1">
                        <li class="text-gray-500 italic">No visited breweries yet</li>
                    </ul>
                </div>
                
                <div>
                    <h3 class="font-bold mb-2">State Breakdown</h3>
                    <div id="stateBreakdown" class="space-y-1">
                        <!-- State breakdown will be populated here -->
                    </div>
                </div>
            </div>
        </div>
    </div>

    <div id="addBreweryModal" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center hidden z-50">
        <div class="bg-white dark:bg-gray-800 rounded-lg shadow-lg max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div class="p-4 border-b">
                <div class="flex justify-between items-center">
                    <h2 class="text-xl font-bold">Add New Brewery</h2>
                    <button id="closeAddBreweryModal" class="text-gray-500 hover:text-gray-700">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>
            </div>
            <div class="p-4">
                <div class="grid grid-cols-1 gap-4">
                    <div>
                        <label for="newBreweryName" class="block text-sm font-medium">Brewery Name*</label>
                        <input type="text" id="newBreweryName" class="mt-1 p-2 border rounded w-full" required>
                    </div>
                    
                    <div>
                        <label for="newBreweryRank" class="block text-sm font-medium">Rank</label>
                        <input type="number" id="newBreweryRank" class="mt-1 p-2 border rounded w-full" min="1">
                    </div>
                    
                    <div>
                        <label for="newBreweryCity" class="block text-sm font-medium">City*</label>
                        <input type="text" id="newBreweryCity" class="mt-1 p-2 border rounded w-full" required>
                    </div>
                    
                    <div>
                        <label for="newBreweryState" class="block text-sm font-medium">State*</label>
                        <select id="newBreweryState" class="mt-1 p-2 border rounded w-full" required>
                            <option value="">Select a state</option>
                            <option value="MD">Maryland</option>
                            <option value="PA">Pennsylvania</option>
                            <option value="VA">Virginia</option>
                            <option value="other">Other</option>
                        </select>
                    </div>
                    
                    <div id="otherStateContainer" class="hidden">
                        <label for="otherState" class="block text-sm font-medium">Other State*</label>
                        <input type="text" id="otherState" class="mt-1 p-2 border rounded w-full">
                    </div>
                    
                    <div>
                        <label for="newBreweryAddress" class="block text-sm font-medium">Address*</label>
                        <input type="text" id="newBreweryAddress" class="mt-1 p-2 border rounded w-full" required>
                    </div>
                    
                    <div class="grid grid-cols-2 gap-2">
                        <div>
                            <label for="newBreweryLat" class="block text-sm font-medium">Latitude*</label>
                            <input type="text" id="newBreweryLat" class="mt-1 p-2 border rounded w-full" required>
                        </div>
                        <div>
                            <label for="newBreweryLng" class="block text-sm font-medium">Longitude*</label>
                            <input type="text" id="newBreweryLng" class="mt-1 p-2 border rounded w-full" required>
                        </div>
                    </div>
                    
                    <button id="geolocateAddress" class="px-3 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 inline-block mr-1" viewBox="0 0 20 20" fill="currentColor">
                            <path fill-rule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clip-rule="evenodd" />
                        </svg>
                        Get Coordinates from Address
                    </button>
                    
                    <div>
                        <label class="flex items-center">
                            <input type="checkbox" id="newBreweryVisited" class="form-checkbox h-4 w-4 text-primary">
                            <span class="ml-2">Visited</span>
                        </label>
                        <div id="newBreweryVisitDateContainer" class="mt-2 hidden">
                            <label for="newBreweryVisitDate" class="block text-sm">Visit Date:</label>
                            <input type="date" id="newBreweryVisitDate" class="mt-1 p-2 border rounded w-full">
                        </div>
                    </div>
                    
                    <div>
                        <label for="newBreweryFlagshipBeer" class="block text-sm font-medium">Flagship Beers</label>
                        <textarea id="newBreweryFlagshipBeer" class="mt-1 p-2 border rounded w-full" rows="3" placeholder="Enter flagship beers, separated by commas"></textarea>
                    </div>
                    
                    <div>
                        <label for="newBreweryNotes" class="block text-sm font-medium">Notes</label>
                        <textarea id="newBreweryNotes" class="mt-1 p-2 border rounded w-full" rows="3"></textarea>
                    </div>
                </div>
                
                <div class="mt-4 flex justify-end">
                    <button id="addNewBrewery" class="px-4 py-2 bg-primary text-white rounded hover:bg-opacity-90">Add Brewery</button>
                </div>
            </div>
        </div>
    </div>

    <div id="loadingOverlay" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div class="bg-white dark:bg-gray-800 rounded-lg p-6 flex flex-col items-center">
            <div class="spinner mb-4"></div>
            <p id="loadingMessage">Loading data...</p>
        </div>
    </div>

    <div id="toast" class="fixed bottom-4 right-4 p-4 rounded shadow-lg transform transition-transform duration-300 translate-y-full opacity-0">
        <p id="toastMessage"></p>
    </div>

    <div id="pullIndicator" class="fixed top-0 left-0 right-0 bg-gray-200 text-center p-2 transform -translate-y-full">
        Pull down to refresh
    </div>

    <script src="https://unpkg.com/leaflet@1.7.1/dist/leaflet.js"></script>
    <script src="js/brewery-data.js"></script>
    <script src="js/app.js"></script>
</body>
</html>
