// Check for dark mode
if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
    document.documentElement.classList.add('dark');
}
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', event => {
    if (event.matches) {
        document.documentElement.classList.add('dark');
    } else {
        document.documentElement.classList.remove('dark');
    }
});

// Variables to store app state
let breweries = [];
let currentBrewery = null;
const markers = [];
let map;
let markerCluster;
let searchTimeout;

// Touch event variables for swipe gestures
let touchStartX = 0;
let touchEndX = 0;
let touchStartY = 0;
let touchEndY = 0;
const swipeThreshold = 100; // Pixels to swipe to trigger action
const pullThreshold = 100; // Pixels to pull down to trigger refresh
let isPulling = false;

// Load brewery data from JSON file or fallback to initialBreweries
async function loadBreweryData() {
    try {
        const response = await fetch('data/breweries.json');
        if (!response.ok) {
            throw new Error('Failed to load brewery data');
        }
        const data = await response.json();
        return initializeBreweryData(data);
    } catch (error) {
        console.warn('Using built-in brewery data:', error);
        return initializeBreweryData(initialBreweries);
    }
}

// Initialize breweries with default values
function initializeBreweryData(baseData) {
    // Either load from localStorage or use provided data
    let savedData = null;
    try {
        const saved = localStorage.getItem('breweryData');
        if (saved) {
            savedData = JSON.parse(saved);
        }
    } catch (e) {
        console.error("Error reading from localStorage:", e);
    }
    
    if (savedData) {
        return savedData;
    }
    
    return baseData.map(brewery => ({
        ...brewery,
        visited: false,
        visitDate: null,
        ratings: { KC: 0, Jeff: 0, Dave: 0 },
        avgRating: 0,
        notes: '',
        untappdURL: ''
    }));
}

// Sync settings
let syncSettings = {
    autoSyncEnabled: true,
    lastSyncTime: null
};

let syncTimer = null;
const syncInterval = 30000; // 30 seconds

function loadSyncSettings() {
    const savedSettings = localStorage.getItem('syncSettings');
    if (savedSettings) {
        try {
            const parsed = JSON.parse(savedSettings);
            syncSettings = { ...syncSettings, ...parsed };
            
            // Update UI based on loaded settings
            document.getElementById('autoSync').checked = syncSettings.autoSyncEnabled;
            if (syncSettings.lastSyncTime) {
                document.getElementById('lastSyncTime').textContent = `Last synced: ${new Date(syncSettings.lastSyncTime).toLocaleTimeString()}`;
            }
        } catch (e) {
            console.error("Error parsing sync settings:", e);
        }
    }
}

function saveSyncSettings() {
    try {
        localStorage.setItem('syncSettings', JSON.stringify(syncSettings));
        return true;
    } catch (e) {
        console.error("Error saving sync settings:", e);
        return false;
    }
}

function setupAutoSync() {
    if (document.getElementById('autoSync').checked) {
        syncTimer = setInterval(syncData, syncInterval);
        document.getElementById('syncStatus').classList.remove('bg-gray-400');
        document.getElementById('syncStatus').classList.add('bg-green-500');
    } else {
        clearInterval(syncTimer);
        document.getElementById('syncStatus').classList.remove('bg-green-500');
        document.getElementById('syncStatus').classList.add('bg-gray-400');
    }
}

function syncData() {
    // Save data to localStorage first
    saveToStorage();
    
    // Then sync with cloud (could be Dropbox API in a real implementation)
    const now = new Date();
    syncSettings.lastSyncTime = now.getTime();
    saveSyncSettings();
    
    document.getElementById('lastSyncTime').textContent = `Last synced: ${now.toLocaleTimeString()}`;
    
    // Flash the sync indicator
    const indicator = document.getElementById('syncStatus');
    indicator.classList.add('bg-blue-500');
    indicator.classList.remove('bg-green-500');
    
    setTimeout(() => {
        indicator.classList.remove('bg-blue-500');
        indicator.classList.add('bg-green-500');
    }, 500);
    
    showToast('Data synchronized successfully', 'success');
}

// Show/hide loading indicator
function showLoading(message = "Loading data...") {
    document.getElementById('loadingMessage').textContent = message;
    document.getElementById('loadingOverlay').classList.remove('hidden');
}

function hideLoading() {
    document.getElementById('loadingOverlay').classList.add('hidden');
}

// Show toast notification
function showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    const toastMessage = document.getElementById('toastMessage');
    
    // Set message and type
    toastMessage.textContent = message;
    toast.className = 'toast ' + type;
    
    // Show toast
    setTimeout(() => {
        toast.classList.add('show');
        
        // Hide toast after 3 seconds
        setTimeout(() => {
            toast.classList.remove('show');
        }, 3000);
    }, 100);
}

// Save data to localStorage
function saveToStorage() {
    try {
        localStorage.setItem('breweryData', JSON.stringify(breweries));
        return true;
    } catch (e) {
        console.error("Error saving to localStorage:", e);
        return false;
    }
}

// Format date for display
function formatDate(dateString) {
    if (!dateString) return 'Not visited';
    return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
}

// Format rating for display
function formatRating(rating) {
    if (!rating || rating === 0) return 'Not rated';
    return rating.toFixed(1);
}

// Create beer mug rating HTML
function createRatingMugs(containerId, person, brewery) {
    const container = document.getElementById(containerId);
    container.innerHTML = '';
    
    for (let i = 1; i <= 5; i++) {
        const mug = document.createElement('div');
        mug.className = `rating-mug ${brewery.ratings[person] >= i ? 'selected' : 'unselected'}`;
        mug.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="#f8b64c">
                <path d="M4,2H19L17,22H6L4,2M6.2,4L7.8,20H8.8L7.43,6.34C8.5,6 9,5 9,4H6.2M9.9,4L11.4,20H12.5L11,4H9.9M16,4L14.6,20H15.6L17.2,4H16M20,2H22V4H20V2M20,10H22V12H20V10M20,18H22V20H20V18Z" />
            </svg>
        `;
        
        mug.dataset.rating = i;
        mug.dataset.person = person;
        
        mug.addEventListener('click', function() {
            const rating = parseInt(this.dataset.rating);
            const personName = this.dataset.person;
            
            // Check if this rating is already selected (allow deselection)
            if (currentBrewery.ratings[personName] === rating) {
                // Deselect/reset the rating
                currentBrewery.ratings[personName] = 0;
            } else {
                // Set new rating
                currentBrewery.ratings[personName] = rating;
            }
            
            // Calculate average
            const ratings = Object.values(currentBrewery.ratings);
            const validRatings = ratings.filter(r => r > 0);
            currentBrewery.avgRating = validRatings.length > 0 ? 
                validRatings.reduce((sum, r) => sum + r, 0) / validRatings.length : 0;
            
            // Update UI
            updateRatingUI(currentBrewery);
        });
        
        container.appendChild(mug);
    }
}

// Update rating UI
function updateRatingUI(brewery) {
    // Update individual ratings
    for (const person of ['KC', 'Jeff', 'Dave']) {
        const container = document.getElementById(`${person.toLowerCase()}Rating`);
        const mugs = container.querySelectorAll('.rating-mug');
        
        mugs.forEach((mug, index) => {
            if (brewery.ratings[person] >= index + 1) {
                mug.classList.add('selected');
                mug.classList.remove('unselected');
            } else {
                mug.classList.add('unselected');
                mug.classList.remove('selected');
            }
        });
    }
    
    // Update average
    const avgElement = document.getElementById('avgRating');
    if (brewery.avgRating > 0) {
        avgElement.textContent = brewery.avgRating.toFixed(1) + ' / 5.0';
    } else {
        avgElement.textContent = 'Not rated';
    }
}

// Calculate statistics
function calculateStats(breweries) {
    // Count visited breweries
    const visitedCount = breweries.filter(b => b.visited).length;
    const visitedPercentage = (visitedCount / breweries.length * 100).toFixed(1);
    
    // Calculate average rating
    const ratedBreweries = breweries.filter(b => b.avgRating > 0);
    const avgOverallRating = ratedBreweries.length > 0 ? 
        ratedBreweries.reduce((sum, b) => sum + b.avgRating, 0) / ratedBreweries.length : 0;
    
    // Get top rated breweries
    const topRated = [...breweries]
        .filter(b => b.avgRating > 0)
        .sort((a, b) => b.avgRating - a.avgRating)
        .slice(0, 5);
    
    // Get recent visits
    const recentVisits = [...breweries]
        .filter(b => b.visited && b.visitDate)
        .sort((a, b) => new Date(b.visitDate) - new Date(a.visitDate))
        .slice(0, 5);
    
    // Count breweries by state
    const stateCount = {};
    breweries.forEach(b => {
        stateCount[b.state] = (stateCount[b.state] || 0) + 1;
    });
    const stateVisited = {};
    breweries.filter(b => b.visited).forEach(b => {
        stateVisited[b.state] = (stateVisited[b.state] || 0) + 1;
    });
    
    return {
        totalBreweries: breweries.length,
        visitedCount,
        visitedPercentage,
        avgOverallRating,
        topRated,
        recentVisits,
        stateCount,
        stateVisited
    };
}

// Update statistics UI
function updateStatsUI(stats) {
    // Update progress bar
    document.getElementById('progressBar').style.width = `${stats.visitedPercentage}%`;
    document.getElementById('progressText').textContent = 
        `${stats.visitedCount} of ${stats.totalBreweries} breweries visited (${stats.visitedPercentage}%)`;
    
    // Update average rating
    document.getElementById('avgOverallRating').textContent = 
        stats.avgOverallRating > 0 ? stats.avgOverallRating.toFixed(1) + ' / 5.0' : 'No ratings yet';
    
    // Update top rated breweries
    const topRatedList = document.getElementById('topRatedList');
    topRatedList.innerHTML = '';
    
    if (stats.topRated.length > 0) {
        stats.topRated.forEach(brewery => {
            const li = document.createElement('li');
            li.className = 'flex justify-between';
            li.innerHTML = `
                <span>${brewery.name}</span>
                <span class="font-bold">${brewery.avgRating.toFixed(1)}</span>
            `;
            li.addEventListener('click', () => openBreweryDetails(brewery));
            topRatedList.appendChild(li);
        });
    } else {
        topRatedList.innerHTML = '<li class="text-gray-500 dark:text-gray-400 italic">No rated breweries yet</li>';
    }
    
    // Update recent visits
    const recentVisitsList = document.getElementById('recentVisitsList');
    recentVisitsList.innerHTML = '';
    
    if (stats.recentVisits.length > 0) {
        stats.recentVisits.forEach(brewery => {
            const li = document.createElement('li');
            li.className = 'flex justify-between';
            li.innerHTML = `
                <span>${brewery.name}</span>
                <span class="text-gray-500 dark:text-gray-400">${formatDate(brewery.visitDate)}</span>
            `;
            li.addEventListener('click', () => openBreweryDetails(brewery));
            recentVisitsList.appendChild(li);
        });
    } else {
        recentVisitsList.innerHTML = '<li class="text-gray-500 dark:text-gray-400 italic">No visited breweries yet</li>';
    }
    
    // Update state breakdown
    const stateBreakdown = document.getElementById('stateBreakdown');
    stateBreakdown.innerHTML = '';
    
    Object.keys(stats.stateCount).sort().forEach(state => {
        const visited = stats.stateVisited[state] || 0;
        const total = stats.stateCount[state];
        const percentage = (visited / total * 100).toFixed(0);
        
        stateBreakdown.innerHTML += `
            <div>${state}: ${visited}/${total} (${percentage}%)</div>
        `;
    });
}

// Define beer mug icons with better visibility
const emptyBeerIcon = L.divIcon({
    html: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="32" height="32" fill="#888888" class="beer-mug-empty" style="filter:drop-shadow(0px 0px 2px rgba(0,0,0,0.5));"><path d="M4,2H19L17,22H6L4,2M6.2,4L7.8,20H8.8L7.43,6.34C8.5,6 9,5 9,4H6.2M9.9,4L11.4,20H12.5L11,4H9.9M16,4L14.6,20H15.6L17.2,4H16M20,2H22V4H20V2M20,10H22V12H20V10M20,18H22V20H20V18Z" stroke="#333" stroke-width="0.5"/></svg>',
    className: '',
    iconSize: [32, 32],
    iconAnchor: [16, 16]
});

const fullBeerIcon = L.divIcon({
    html: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="32" height="32" fill="#3b82f6" class="beer-mug-full" style="filter:drop-shadow(0px 0px 2px rgba(0,0,0,0.5));"><path d="M4,2H19L17,22H6L4,2M6.2,4L7.8,20H8.8L7.43,6.34C8.5,6 9,5 9,4H6.2M9.9,4L11.4,20H12.5L11,4H9.9M16,4L14.6,20H15.6L17.2,4H16M20,2H22V4H20V2M20,10H22V12H20V10M20,18H22V20H20V18Z" stroke="#333" stroke-width="0.5"/></svg>',
    className: '',
    iconSize: [32, 32],
    iconAnchor: [16, 16]
});

// Create brewery marker
function createBreweryMarker(brewery) {
    const icon = brewery.visited ? fullBeerIcon : emptyBeerIcon;
    
    const marker = L.marker([brewery.lat, brewery.lng], {
        icon: icon,
        title: brewery.name
    });
    
    // Create popup content with flagship beer preview
    const flagshipPreview = brewery.flagshipBeer ? 
        `<p><strong>Flagship Beer:</strong> ${brewery.flagshipBeer.split(',')[0].trim()}${brewery.flagshipBeer.includes(',') ? '...' : ''}</p>` : '';
    
    const popupContent = `
        <div class="brewery-popup">
            <h3>${brewery.name}</h3>
            <p><strong>Rank:</strong> ${brewery.rank}</p>
            <p><strong>Location:</strong> ${brewery.city}, ${brewery.state}</p>
            <p><strong>Address:</strong> ${brewery.address}</p>
            <p><strong>Visited:</strong> ${brewery.visited ? 'Yes' : 'No'}</p>
            ${brewery.visited && brewery.visitDate ? `<p><strong>Visit Date:</strong> ${formatDate(brewery.visitDate)}</p>` : ''}
            ${brewery.avgRating > 0 ? `<p><strong>Rating:</strong> ${brewery.avgRating.toFixed(1)} / 5</p>` : ''}
            ${flagshipPreview}
            <button class="details-btn px-2 py-1 mt-2 bg-beer-light text-beer-dark rounded hover:bg-opacity-90" 
                onclick="openBreweryDetails(${JSON.stringify(brewery).replace(/"/g, '&quot;')})">View Details</button>
        </div>
    `;
    
    // Simply bind the content to the popup
    marker.bindPopup(popupContent);
    
    return marker;
}

// Update brewery marker
function updateBreweryMarker(brewery, marker) {
    // Update icon based on visited status
    const icon = brewery.visited ? fullBeerIcon : emptyBeerIcon;
    marker.setIcon(icon);
    
    // Create popup content with flagship beer preview
    const flagshipPreview = brewery.flagshipBeer ? 
        `<p><strong>Flagship Beer:</strong> ${brewery.flagshipBeer.split(',')[0].trim()}${brewery.flagshipBeer.includes(',') ? '...' : ''}</p>` : '';
    
    // Update popup content
    const popupContent = `
        <div class="brewery-popup">
            <h3>${brewery.name}</h3>
            <p><strong>Rank:</strong> ${brewery.rank}</p>
            <p><strong>Location:</strong> ${brewery.city}, ${brewery.state}</p>
            <p><strong>Address:</strong> ${brewery.address}</p>
            <p><strong>Visited:</strong> ${brewery.visited ? 'Yes' : 'No'}</p>
            ${brewery.visited && brewery.visitDate ? `<p><strong>Visit Date:</strong> ${formatDate(brewery.visitDate)}</p>` : ''}
            ${brewery.avgRating > 0 ? `<p><strong>Rating:</strong> ${brewery.avgRating.toFixed(1)} / 5</p>` : ''}
            ${flagshipPreview}
            <button class="details-btn px-2 py-1 mt-2 bg-beer-light text-beer-dark rounded hover:bg-opacity-90" 
                onclick="openBreweryDetails(${JSON.stringify(brewery).replace(/"/g, '&quot;')})">View Details</button>
        </div>
    `;
    
    marker.getPopup().setContent(popupContent);
}

// Create brewery list item with quick actions
function createBreweryListItem(brewery) {
    const listItem = document.createElement('div');
    listItem.className = 'brewery-list-item bg-white dark:bg-gray-700 rounded shadow p-3 hover:bg-gray-50 dark:hover:bg-gray-600 cursor-pointer';
    
    // Calculate rating stars
    const ratingStars = [];
    if (brewery.avgRating > 0) {
        const fullStars = Math.floor(brewery.avgRating);
        const halfStar = brewery.avgRating - fullStars >= 0.5;
        
        for (let i = 0; i < 5; i++) {
            if (i < fullStars) {
                ratingStars.push('<svg class="inline-block" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="#f8b64c"><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/></svg>');
            } else if (i === fullStars && halfStar) {
                ratingStars.push('<svg class="inline-block" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="#f8b64c"><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" fill-opacity="0.5"/><path d="M12 2v15.27l-6.18 3.73 1.64-7.03L2 9.24l7.19-.61L12 2z"/></svg>');
            } else {
                ratingStars.push('<svg class="inline-block" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="#f8b64c" fill-opacity="0.3"><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/></svg>');
            }
        }
    }
    
    listItem.innerHTML = `
        <div class="flex items-start">
            <div class="mr-3 mt-1">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="${brewery.visited ? '#3b82f6' : '#888888'}" class="${brewery.visited ? 'beer-mug-full' : 'beer-mug-empty'}">
                    <path d="M4,2H19L17,22H6L4,2M6.2,4L7.8,20H8.8L7.43,6.34C8.5,6 9,5 9,4H6.2M9.9,4L11.4,20H12.5L11,4H9.9M16,4L14.6,20H15.6L17.2,4H16M20,2H22V4H20V2M20,10H22V12H20V10M20,18H22V20H20V18Z" />
                </svg>
            </div>
            <div class="flex-grow">
                <h3 class="font-bold">${brewery.name}</h3>
                <p class="text-sm text-gray-600 dark:text-gray-400">${brewery.city}, ${brewery.state}</p>
                <div class="flex items-center mt-1">
                    <span class="text-xs px-2 py-0.5 bg-gray-200 dark:bg-gray-600 rounded mr-2">Rank #${brewery.rank}</span>
                    ${brewery.avgRating > 0 ? 
                        `<span class="flex items-center">${ratingStars.join('')} <span class="ml-1 text-sm">${brewery.avgRating.toFixed(1)}</span></span>` : 
                        '<span class="text-xs text-gray-500 dark:text-gray-400">Not rated</span>'}
                </div>
                ${brewery.visited && brewery.visitDate ? 
                    `<p class="text-xs text-gray-500 dark:text-gray-400 mt-1">Visited: ${formatDate(brewery.visitDate)}</p>` : ''}
                
                <!-- Quick Actions -->
                <div class="flex mt-2 pt-2 border-t border-gray-200 dark:border-gray-600">
                    <button class="quick-action-btn mr-2 text-xs px-2 py-1 bg-gray-100 dark:bg-gray-600 rounded" data-action="visit" data-brewery="${brewery.name}">
                        ${brewery.visited ? 'Unvisit' : 'Mark Visited'}
                    </button>
                    <button class="quick-action-btn mr-2 text-xs px-2 py-1 bg-gray-100 dark:bg-gray-600 rounded" data-action="directions" data-brewery="${brewery.name}">
                        Directions
                    </button>
                    <button class="quick-action-btn text-xs px-2 py-1 bg-gray-100 dark:bg-gray-600 rounded" data-action="untappd" data-brewery="${brewery.name}">
                        Untappd
                    </button>
                </div>
            </div>
        </div>
    `;
    
    // Add event listener for the whole item
    listItem.addEventListener('click', function(e) {
        // Don't open details if clicking on a quick action button
        if (e.target.classList.contains('quick-action-btn')) {
            e.stopPropagation();
            
            const action = e.target.dataset.action;
            const breweryName = e.target.dataset.brewery;
            const breweryObj = breweries.find(b => b.name === breweryName);
            
            if (!breweryObj) return;
            
            if (action === 'visit') {
                // Toggle visited status
                breweryObj.visited = !breweryObj.visited;
                if (breweryObj.visited && !breweryObj.visitDate) {
                    breweryObj.visitDate = new Date().toISOString().split('T')[0];
                }
                
                // Update UI
                const markerObj = markers.find(m => m.brewery.name === breweryName);
                if (markerObj) {
                    updateBreweryMarker(breweryObj, markerObj.marker);
                }
                saveToStorage();
                
                // Refresh list item
                const newListItem = createBreweryListItem(breweryObj);
                listItem.replaceWith(newListItem);
                
                showToast(`${breweryObj.name} marked as ${breweryObj.visited ? 'visited' : 'not visited'}`, 'success');
            } else if (action === 'directions') {
                // Open Google Maps directions
                window.open(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(breweryObj.address)}`, '_blank');
            } else if (action === 'untappd') {
                // Open Untappd
                const untappdURL = breweryObj.untappdURL || generateUntappdURL(breweryObj);
                window.open(untappdURL, '_blank');
            }
            
            return;
        }
        
        // Open brewery details
        openBreweryDetails(brewery);
    });
    
    return listItem;
}

// Generate Untappd URL from brewery name
function generateUntappdURL(brewery) {
    // Special cases
    if (brewery.name.includes("Sapwood Cellars")) {
        return "https://untappd.com/Sapwood_Cellars";
    } else if (brewery.name.includes("Black Flag")) {
        return "https://untappd.com/BlackFlagBrewingCompany";
    }
    
    // Generic formatting
    let formattedName = brewery.name
        .replace(/\s+(Brewery|Brewing|Brewpub|Brew\s+Pub|Brewing\s+Company|Brewing\s+Co\.?|Beer\s+Co\.?|Brew\s+Co\.?)$/i, '')
        .trim()
        .replace(/[^a-zA-Z0-9\s]/g, '')
        .replace(/\s+/g, '_');
    
    return `https://untappd.com/${formattedName}`;
}

// Make openBreweryDetails available globally for popup click handlers
function openBreweryDetails(brewery) {
    // If brewery is a string (from onclick attribute), parse it
    if (typeof brewery === 'string') {
        try {
            brewery = JSON.parse(brewery);
        } catch (e) {
            console.error("Error parsing brewery data:", e);
            return;
        }
    }
    
    currentBrewery = brewery;
    
    // Set modal title and info
    document.getElementById('modalTitle').textContent = brewery.name;
    document.getElementById('modalRank').textContent = `Rank: #${brewery.rank}`;
    document.getElementById('modalLocation').textContent = `Location: ${brewery.city}, ${brewery.state}`;
    document.getElementById('modalAddress').textContent = `Address: ${brewery.address}`;
    document.getElementById('modalAddress').onclick = function() {
        window.open(`https://maps.google.com/?q=${encodeURIComponent(brewery.address)}`, '_blank');
    };
    
    // Format and display flagship beer information
    if (brewery.flagshipBeer) {
        const beerHTML = brewery.flagshipBeer
            .split(',')
            .map(beer => `<li class="mb-1">• ${beer.trim()}</li>`)
            .join('');
        document.getElementById('modalFlagshipBeer').innerHTML = `<ul class="list-none pl-1">${beerHTML}</ul>`;
    } else {
        document.getElementById('modalFlagshipBeer').textContent = 'Information not available';
    }
    
    // Set visited checkbox and date
    document.getElementById('visitedCheckbox').checked = brewery.visited;
    document.getElementById('visitDateContainer').style.display = brewery.visited ? 'block' : 'none';
    document.getElementById('visitDate').value = brewery.visitDate || '';
    
    // Set ratings
    createRatingMugs('kcRating', 'KC', brewery);
    createRatingMugs('jeffRating', 'Jeff', brewery);
    createRatingMugs('daveRating', 'Dave', brewery);
    
    // Update average rating display
    const avgElement = document.getElementById('avgRating');
    if (brewery.avgRating > 0) {
        avgElement.textContent = brewery.avgRating.toFixed(1) + ' / 5.0';
    } else {
        avgElement.textContent = 'Not rated';
    }
    
    // Set notes and Untappd URL
    document.getElementById('breweryNotes').value = brewery.notes || '';
    document.getElementById('untappdURL').value = brewery.untappdURL || '';
    
    // Set Untappd link
    const untappdURL = brewery.untappdURL || generateUntappdURL(brewery);
    document.getElementById('untappdLink').href = untappdURL;
    
    // Show modal
    document.getElementById('detailsModal').classList.remove('hidden');
}

// Make the function available globally for onclick handlers
window.openBreweryDetails = openBreweryDetails;

// Close brewery details modal
function closeBreweryDetails() {
    document.getElementById('detailsModal').classList.add('hidden');
    currentBrewery = null;
}

// Save brewery details
function saveBreweryDetails() {
    if (!currentBrewery) return;
    
    // Get values from form
    const visited = document.getElementById('visitedCheckbox').checked;
    const visitDate = visited ? document.getElementById('visitDate').value : null;
    const notes = document.getElementById('breweryNotes').value;
    const untappdURL = document.getElementById('untappdURL').value.trim();
    
    // Update brewery object
    currentBrewery.visited = visited;
    currentBrewery.visitDate = visitDate;
    currentBrewery.notes = notes;
    currentBrewery.untappdURL = untappdURL;
    
    // Update brewery in the breweries array
    const index = breweries.findIndex(b => b.name === currentBrewery.name && b.city === currentBrewery.city);
    if (index !== -1) {
        breweries[index] = currentBrewery;
        
        // Update marker if it exists
        if (index < markers.length && markers[index]) {
            updateBreweryMarker(currentBrewery, markers[index].marker);
        }
        
        // Update list item
        const listItems = document.querySelectorAll('.brewery-list-item');
        if (index < listItems.length) {
            const listItem = listItems[index];
            const newListItem = createBreweryListItem(currentBrewery);
            listItem.replaceWith(newListItem);
        }
        
        // Save to localStorage
        saveToStorage();
        
        // Update stats
        updateStatsUI(calculateStats(breweries));
        
        // Apply filters
        filterBreweries();
        
        // If auto-sync is enabled, sync the data
        if (document.getElementById('autoSync').checked) {
            syncData();
        }
    }
    
    // Close modal
    closeBreweryDetails();
    
    // Show success toast
    showToast("Brewery saved successfully!", "success");
}

// Filter breweries based on search, state, visited status and rating
function filterBreweries() {
    const searchText = document.getElementById('searchInput').value.toLowerCase();
    const stateFilter = document.getElementById('stateFilter').value;
    const visitedFilter = document.getElementById('visitedFilter').value;
    const ratingFilter = parseInt(document.getElementById('ratingFilter').value);
    
    breweries.forEach((brewery, index) => {
        if (index >= markers.length) return; // Skip if marker doesn't exist
        
        const marker = markers[index].marker;
        const listItems = document.querySelectorAll('.brewery-list-item');
        const listItem = index < listItems.length ? listItems[index] : null;
        
        // Check if brewery matches all filter criteria
        const matchesSearch = brewery.name.toLowerCase().includes(searchText) || 
                            brewery.city.toLowerCase().includes(searchText);
        const matchesState = stateFilter === 'all' || brewery.state === stateFilter;
        const matchesVisited = visitedFilter === 'all' || 
                            (visitedFilter === 'visited' && brewery.visited) || 
                            (visitedFilter === 'notVisited' && !brewery.visited);
        const matchesRating = isNaN(ratingFilter) || 
                            (ratingFilter === 0 && brewery.avgRating === 0) ||
                            (brewery.avgRating >= ratingFilter);
        
        const isVisible = matchesSearch && matchesState && matchesVisited && matchesRating;
        
        // Show or hide marker
        if (isVisible) {
            if (!map.hasLayer(marker)) {
                marker.addTo(map);
            }
        } else {
            if (map.hasLayer(marker)) {
                map.removeLayer(marker);
            }
        }
        
        // Show or hide list item
        if (listItem) {
            listItem.style.display = isVisible ? 'block' : 'none';
        }
    });
    
    // Re-setup swipe listeners after filtering
    setupSwipeListeners();
}

// Calculate distance between two coordinates in kilometers
function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Radius of the earth in km
    const dLat = deg2rad(lat2 - lat1);
    const dLon = deg2rad(lon2 - lon1);
    const a = 
        Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * 
        Math.sin(dLon/2) * Math.sin(dLon/2); 
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
    const distance = R * c; // Distance in km
    return Math.round(distance);
}

function deg2rad(deg) {
    return deg * (Math.PI/180);
}

function sortBreweriesByDistance() {
    // Sort the breweries array by distance
    breweries.sort((a, b) => a.distance - b.distance);
    
    // Rebuild the brewery list
    const breweryList = document.getElementById('breweryList');
    breweryList.innerHTML = '';
    
    breweries.forEach(brewery => {
        const listItem = createBreweryListItem(brewery);
        breweryList.appendChild(listItem);
    });
    
    // Add a "Sort by" dropdown to allow switching back to rank
    if (!document.getElementById('sortByDistance')) {
        const sortControl = document.createElement('div');
        sortControl.id = 'sortByDistance';
        sortControl.className = 'mb-3 flex items-center justify-between';
        sortControl.innerHTML = `
            <span class="text-sm">Sorted by: Distance</span>
            <button class="text-sm text-primary hover:underline" id="sortByRank">Sort by Rank</button>
        `;
        breweryList.parentNode.insertBefore(sortControl, breweryList);
        
        document.getElementById('sortByRank').addEventListener('click', function() {
            // Sort by rank
            breweries.sort((a, b) => a.rank - b.rank);
            
            // Rebuild the list
            breweryList.innerHTML = '';
            breweries.forEach(brewery => {
                const listItem = createBreweryListItem(brewery);
                breweryList.appendChild(listItem);
            });
            
            // Update sort control
            sortControl.innerHTML = `
                <span class="text-sm">Sorted by: Rank</span>
                <button class="text-sm text-primary hover:underline" id="sortByDistance">Sort by Distance</button>
            `;
            
            document.getElementById('sortByDistance').addEventListener('click', sortBreweriesByDistance);
            
            // Re-setup swipe listeners
            setupSwipeListeners();
        });
    }
    
    // Re-setup swipe listeners
    setupSwipeListeners();
}

// Export breweries data as a JSON file for the user to save
function exportBreweryData() {
    try {
        const dataStr = JSON.stringify(breweries, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(dataBlob);
        
        const downloadLink = document.createElement('a');
        downloadLink.href = url;
        downloadLink.download = 'brewery_tracker_data.json';
        document.body.appendChild(downloadLink);
        downloadLink.click();
        document.body.removeChild(downloadLink);
        URL.revokeObjectURL(url);
        
        showToast('Data exported successfully!', 'success');
    } catch (error) {
        console.error('Error exporting brewery data:', error);
        showToast('Error exporting data. Please try again.', 'error');
    }
}

// Import breweries data from a JSON file
function importBreweryData(event) {
    try {
        showLoading("Importing data...");
        
        const file = event.target.files[0];
        if (!file) {
            hideLoading();
            return;
        }
        
        const reader = new FileReader();
        reader.onload = function(e) {
            try {
                const importedData = JSON.parse(e.target.result);
                
                // Confirm before overwriting
                if (!confirm("This will replace all brewery data. Continue?")) {
                    hideLoading();
                    return;
                }
                
                // Replace breweries
                breweries = importedData;
                
                // Save to localStorage
                saveToStorage();
                
                // Reset map and rebuild UI
                markers.forEach(m => {
                    if (map.hasLayer(m.marker)) {
                        map.removeLayer(m.marker);
                    }
                });
                markers.length = 0;
                initializeBreweries();
                
                hideLoading();
                showToast('Data imported successfully!', 'success');
            } catch (parseError) {
                console.error('Error parsing imported data:', parseError);
                hideLoading();
                showToast('Invalid file format. Please select a valid brewery tracker JSON file.', 'error');
            }
        };
        reader.readAsText(file);
    } catch (error) {
        console.error('Error importing brewery data:', error);
        hideLoading();
        showToast('Error importing data. Please try again.', 'error');
    }
}

// Initialize the map
function initializeMap() {
    map = L.map('map').setView([39.5, -77], 7);

    // Add OpenStreetMap tiles
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);

    // Add legend
    const legend = L.control({position: 'bottomright'});
    legend.onAdd = function (map) {
        const div = L.DomUtil.create('div', 'legend');
        div.innerHTML = `
            <div class="mb-2">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18" fill="#888888" class="beer-mug-empty">
                    <path d="M4,2H19L17,22H6L4,2M6.2,4L7.8,20H8.8L7.43,6.34C8.5,6 9,5 9,4H6.2M9.9,4L11.4,20H12.5L11,4H9.9M16,4L14.6,20H15.6L17.2,4H16M20,2H22V4H20V2M20,10H22V12H20V10M20,18H22V20H20V18Z" />
                </svg> Not Visited
            </div>
            <div>
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18" fill="#3b82f6" class="beer-mug-full">
                    <path d="M4,2H19L17,22H6L4,2M6.2,4L7.8,20H8.8L7.43,6.34C8.5,6 9,5 9,4H6.2M9.9,4L11.4,20H12.5L11,4H9.9M16,4L14.6,20H15.6L17.2,4H16M20,2H22V4H20V2M20,10H22V12H20V10M20,18H22V20H20V18Z" />
                </svg> Visited
            </div>
        `;
        return div;
    };
    legend.addTo(map);
}

// Initialize breweries on the map and in the list
function initializeBreweries() {
    const breweryList = document.getElementById('breweryList');
    breweryList.innerHTML = '';
    
    // Reset markers array first
    markers.forEach(m => {
        if (map && map.hasLayer(m.marker)) {
            map.removeLayer(m.marker);
        }
    });
    markers.length = 0;
    
    breweries.forEach(brewery => {
        // Create marker
        const marker = createBreweryMarker(brewery);
        marker.addTo(map);
        markers.push({ marker, brewery });
        
        // Create list item
        const listItem = createBreweryListItem(brewery);
        breweryList.appendChild(listItem);
    });
    
    // Update stats
    updateStatsUI(calculateStats(breweries));
    
    // Setup swipe listeners for mobile
    setupSwipeListeners();
}

// Set up swipe event listeners for brewery list items
function setupSwipeListeners() {
    const listItems = document.querySelectorAll('.brewery-list-item');
    
    listItems.forEach(item => {
        // Remove existing listeners to prevent duplicates
        item.removeEventListener('touchstart', handleTouchStart);
        item.removeEventListener('touchend', handleTouchEnd);
        
        // Add new listeners
        item.addEventListener('touchstart', handleTouchStart, { passive: true });
        item.addEventListener('touchend', handleTouchEnd, { passive: true });
    });
}

function handleTouchStart(e) {
    touchStartX = e.touches[0].clientX;
}

function handleTouchEnd(e) {
    touchEndX = e.changedTouches[0].clientX;
    handleSwipe(this);
}

function handleSwipe(element) {
    const swipeDistance = touchEndX - touchStartX;
    
    // Get brewery data from the element
    const breweryName = element.querySelector('h3').textContent;
    const brewery = breweries.find(b => b.name === breweryName);
    
    if (!brewery) return;
    
    if (swipeDistance < -swipeThreshold) {
        // Swipe left - Mark as visited/unvisited
        brewery.visited = !brewery.visited;
        if (brewery.visited && !brewery.visitDate) {
            brewery.visitDate = new Date().toISOString().split('T')[0];
        }
        
        // Update UI
        const markerObj = markers.find(m => m.brewery.name === breweryName);
        if (markerObj) {
            updateBreweryMarker(brewery, markerObj.marker);
        }
        saveToStorage();
        
        // Refresh list item
        const newListItem = createBreweryListItem(brewery);
        element.replaceWith(newListItem);
        
        showToast(`${brewery.name} marked as ${brewery.visited ? 'visited' : 'not visited'}`, 'success');
        
        // Re-setup swipe listeners
        setupSwipeListeners();
    } else if (swipeDistance > swipeThreshold) {
        // Swipe right - Show on map
        const markerObj = markers.find(m => m.brewery.name === breweryName);
        if (markerObj) {
            // Center map on brewery
            map.setView([brewery.lat, brewery.lng], 14);
            
            // Open popup
            markerObj.marker.openPopup();
            
            // Switch to map view on mobile
            if (window.innerWidth < 768) {
                document.getElementById('showMapBtn').click();
            }
        }
    }
}

// Pull-to-refresh functionality
function setupPullToRefresh() {
    // Set up touch event listeners
    document.addEventListener('touchstart', function(e) {
        touchStartY = e.touches[0].clientY;
        
        // Only enable pull-to-refresh at the top of the page
        if (window.scrollY <= 0) {
            isPulling = true;
        }
    }, { passive: true });

    document.addEventListener('touchmove', function(e) {
        if (!isPulling) return;
        
        touchEndY = e.touches[0].clientY;
        const pullDistance = touchEndY - touchStartY;
        
        if (pullDistance > 0 && pullDistance < pullThreshold) {
            // Show pull indicator with progress
            const progress = pullDistance / pullThreshold;
            document.getElementById('pullIndicator').style.transform = `translateY(${pullDistance * 0.5}px)`;
            document.getElementById('pullIndicator').innerHTML = 'Pull down to refresh';
        } else if (pullDistance >= pullThreshold) {
            document.getElementById('pullIndicator').innerHTML = 'Release to refresh';
        }
    }, { passive: true });

    document.addEventListener('touchend', function() {
        if (!isPulling) return;
        
        const pullDistance = touchEndY - touchStartY;
        
        // Reset the indicator
        document.getElementById('pullIndicator').style.transform = 'translateY(-100%)';
        
        if (pullDistance >= pullThreshold) {
            // Perform refresh
            showLoading('Refreshing data...');
            
            // Reload data
            setTimeout(() => {
                // Reload from localStorage or JSON
                loadBreweryData().then(data => {
                    breweries = data;
                    initializeBreweries();
                    hideLoading();
                    showToast('Data refreshed successfully!', 'success');
                });
            }, 1000);
        }
        
        isPulling = false;
    }, { passive: true });
}

// Current location functionality
function setupCurrentLocation() {
    document.getElementById('currentLocationButton').addEventListener('click', function() {
        if (navigator.geolocation) {
            // Show loading state
            this.innerHTML = '<div class="spinner" style="width: 24px; height: 24px;"></div>';
            
            navigator.geolocation.getCurrentPosition(
                function(position) {
                    const lat = position.coords.latitude;
                    const lng = position.coords.longitude;
                    
                    // Center map on current location
                    map.setView([lat, lng], 12);
                    
                    // Add a temporary marker
                    const userMarker = L.marker([lat, lng], {
                        icon: L.divIcon({
                            html: '<div class="w-4 h-4 bg-blue-500 rounded-full border-2 border-white"></div>',
                            className: 'user-location-marker',
                            iconSize: [20, 20],
                            iconAnchor: [10, 10]
                        })
                    }).addTo(map);
                    
                    // Add a circle to show accuracy
                    const accuracyCircle = L.circle([lat, lng], {
                        radius: position.coords.accuracy,
                        color: '#3b82f6',
                        fillColor: '#3b82f6',
                        fillOpacity: 0.1
                    }).addTo(map);
                    
                    // Remove after 10 seconds
                    setTimeout(() => {
                        map.removeLayer(userMarker);
                        map.removeLayer(accuracyCircle);
                    }, 10000);
                    
                    // Calculate distances to all breweries
                    breweries.forEach(brewery => {
                        brewery.distance = calculateDistance(lat, lng, brewery.lat, brewery.lng);
                    });
                    
                    // Sort breweries by distance for the list view
                    sortBreweriesByDistance();
                    
                    // Reset button
                    document.getElementById('currentLocationButton').innerHTML = `
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-primary" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M12 8c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4-1.79-4-4-4zm8.94 3A8.994 8.994 0 0 0 13 3.06V1h-2v2.06A8.994 8.994 0 0 0 3.06 11H1v2h2.06A8.994 8.994 0 0 0 11 20.94V23h2v-2.06A8.994 8.994 0 0 0 20.94 13H23v-2h-2.06zM12 19c-3.87 0-7-3.13-7-7s3.13-7 7-7 7 3.13 7 7-3.13 7-7 7z"/>
                        </svg>
                    `;
                    
                    showToast('Current location found!', 'success');
                },
                function(error) {
                    console.error('Error getting location:', error);
                    let errorMsg = 'Could not get your location.';
                    
                    switch(error.code) {
                        case error.PERMISSION_DENIED:
                            errorMsg += ' Location access was denied.';
                            break;
                        case error.POSITION_UNAVAILABLE:
                            errorMsg += ' Location information is unavailable.';
                            break;
                        case error.TIMEOUT:
                            errorMsg += ' Request timed out.';
                            break;
                    }
                    
                    showToast(errorMsg, 'error');
                    
                    // Reset button
                    document.getElementById('currentLocationButton').innerHTML = `
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-primary" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M12 8c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4-1.79-4-4-4zm8.94 3A8.994 8.994 0 0 0 13 3.06V1h-2v2.06A8.994 8.994 0 0 0 3.06 11H1v2h2.06A8.994 8.994 0 0 0 11 20.94V23h2v-2.06A8.994 8.994 0 0 0 20.94 13H23v-2h-2.06zM12 19c-3.87 0-7-3.13-7-7s3.13-7 7-7 7 3.13 7 7-3.13 7-7 7z"/>
                        </svg>
                    `;
                },
                {
                    enableHighAccuracy: true,
                    timeout: 10000,
                    maximumAge: 0
                }
            );
        } else {
            showToast('Geolocation is not supported by your browser.', 'error');
        }
    });
}

// Enhanced mobile view toggle for iOS
function setupMobileViewToggle() {
    const showMapBtn = document.getElementById('showMapBtn');
    const showListBtn = document.getElementById('showListBtn');
    const mapContainer = document.getElementById('mapContainer');
    const listContainer = document.querySelector('.md\\:w-1\\/3');
    
    if (showMapBtn && showListBtn && mapContainer && listContainer) {
        // Map button - show map, hide list
        showMapBtn.addEventListener('click', function() {
            // Show map, hide list
            mapContainer.classList.remove('h-1/2');
            mapContainer.classList.add('h-full');
            listContainer.classList.add('hidden');
            
            // Update button styles
            this.classList.add('bg-primary', 'text-white');
            this.classList.remove('bg-white', 'dark:bg-gray-700', 'text-gray-700', 'dark:text-white');
            showListBtn.classList.remove('bg-primary', 'text-white');
            showListBtn.classList.add('bg-white', 'dark:bg-gray-700', 'text-gray-700', 'dark:text-white');
            
            // Set ARIA attributes
            this.setAttribute('aria-pressed', 'true');
            showListBtn.setAttribute('aria-pressed', 'false');
            
            // Trigger map resize event to fix any display issues
            setTimeout(() => {
                if (typeof map !== 'undefined' && map.invalidateSize) {
                    map.invalidateSize();
                }
            }, 100);
        });
        
        // List button - show list, hide map
        showListBtn.addEventListener('click', function() {
            // Show list, hide map
            mapContainer.classList.add('h-1/2');
            mapContainer.classList.remove('h-full');
            listContainer.classList.remove('hidden');
            
            // Update button styles
            this.classList.add('bg-primary', 'text-white');
            this.classList.remove('bg-white', 'dark:bg-gray-700', 'text-gray-700', 'dark:text-white');
            showMapBtn.classList.remove('bg-primary', 'text-white');
            showMapBtn.classList.add('bg-white', 'dark:bg-gray-700', 'text-gray-700', 'dark:text-white');
            
            // Set ARIA attributes
            this.setAttribute('aria-pressed', 'true');
            showMapBtn.setAttribute('aria-pressed', 'false');
        });
        
        // Add specific touch event listeners for iOS
        if ('ontouchend' in document) {
            showMapBtn.addEventListener('touchend', function(e) {
                e.preventDefault();
                this.click();
            }, {passive: false});
            
            showListBtn.addEventListener('touchend', function(e) {
                e.preventDefault();
                this.click();
            }, {passive: false});
        }
    }
}

// Enhanced mobile buttons with fixed iOS touch handling
function enhanceMobileButtons() {
    // Fix for Add button
    const addButton = document.getElementById('addBreweryButton');
    if (addButton) {
        addButton.addEventListener('touchend', function(e) {
            e.preventDefault();
            e.stopPropagation();
            document.getElementById('addBreweryModal').classList.remove('hidden');
        }, {passive: false});
    }
    
    // Fix for Stats button
    const statsButton = document.getElementById('statsButton');
    if (statsButton) {
        statsButton.addEventListener('touchend', function(e) {
            e.preventDefault();
            e.stopPropagation();
            document.getElementById('statsModal').classList.remove('hidden');
            updateStatsUI(calculateStats(breweries));
        }, {passive: false});
    }
    
    // Fix for Sync button
    const syncButton = document.getElementById('syncButton');
    if (syncButton) {
        syncButton.addEventListener('touchend', function(e) {
            e.preventDefault();
            e.stopPropagation();
            document.getElementById('syncDropdown').classList.toggle('hidden');
        }, {passive: false});
    }
}

// Set up all event listeners
function setupEventListeners() {
    // Brewery details modal
    document.getElementById('visitedCheckbox').addEventListener('change', function() {
        document.getElementById('visitDateContainer').style.display = this.checked ? 'block' : 'none';
        if (this.checked && !document.getElementById('visitDate').value) {
            document.getElementById('visitDate').value = new Date().toISOString().split('T')[0];
        }
    });

    document.getElementById('closeModal').addEventListener('click', closeBreweryDetails);
    document.getElementById('saveBrewery').addEventListener('click', saveBreweryDetails);
    
    // Stats modal
    document.getElementById('statsButton').addEventListener('click', function() {
        document.getElementById('statsModal').classList.remove('hidden');
        updateStatsUI(calculateStats(breweries));
    });
    
    document.getElementById('closeStatsModal').addEventListener('click', function() {
        document.getElementById('statsModal').classList.add('hidden');
    });
    
    // Sync dropdown
    document.getElementById('syncButton').addEventListener('click', function() {
        document.getElementById('syncDropdown').classList.toggle('hidden');
    });
    
    // Hide dropdown when clicking elsewhere
    document.addEventListener('click', function(event) {
        if (!event.target.closest('#syncButton') && !event.target.closest('#syncDropdown')) {
            document.getElementById('syncDropdown').classList.add('hidden');
        }
    });
    
    // Auto-sync toggle
    document.getElementById('autoSync').addEventListener('change', function() {
        syncSettings.autoSyncEnabled = this.checked;
        saveSyncSettings();
        setupAutoSync();
    });
    
    // Manual sync
    document.getElementById('manualSync').addEventListener('click', syncData);
    
    // Export data
    document.getElementById('exportData').addEventListener('click', function() {
        exportBreweryData();
        document.getElementById('syncDropdown').classList.add('hidden');
    });
    
    // Import data
    document.getElementById('importData').addEventListener('click', function() {
        document.getElementById('fileInput').click();
        document.getElementById('syncDropdown').classList.add('hidden');
    });
    
    // Handle file selection
    document.getElementById('fileInput').addEventListener('change', importBreweryData);
    
    // Test Untappd URL
    document.getElementById('testUntappdLink').addEventListener('click', function() {
        const url = document.getElementById('untappdURL').value.trim();
        if (url) {
            window.open(url, '_blank');
        } else {
            // Generate URL based on brewery name
            if (currentBrewery) {
                const generatedUrl = generateUntappdURL(currentBrewery);
                window.open(generatedUrl, '_blank');
            }
        }
    });
    
    // Fix common errors in Untappd URLs
    document.getElementById('fixCommonUntappdErrors').addEventListener('click', function() {
        let url = document.getElementById('untappdURL').value.trim();
        
        if (!url && currentBrewery) {
            // Generate URL based on brewery name
            url = generateUntappdURL(currentBrewery);
        } else if (url) {
            // Fix common issues in existing URLs
            if (!url.startsWith('http')) {
                url = 'https://' + url;
            }
            
            if (url.includes('untappd.com/search')) {
                // Convert search URL to direct URL
                try {
                    const searchTerms = new URL(url).searchParams.get('q');
                    if (searchTerms) {
                        const formattedTerms = searchTerms.replace(/\s+/g, '_');
                        url = `https://untappd.com/${formattedTerms}`;
                    }
                } catch (e) {
                    console.error("Error parsing URL:", e);
                }
            }
            
            // Fix common typos
            url = url.replace('untaped.com', 'untappd.com')
                     .replace('untapd.com', 'untappd.com');
        }
        
        document.getElementById('untappdURL').value = url;
        document.getElementById('untappdLink').href = url;
        
        showToast("URL updated. Test it by clicking 'Test URL'", "info");
    });
    
    // Filter listeners with debounce for search input
    clearTimeout(searchTimeout);
    document.getElementById('searchInput').addEventListener('input', function() {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(filterBreweries, 300);
    });
    
    document.getElementById('stateFilter').addEventListener('change', filterBreweries);
    document.getElementById('visitedFilter').addEventListener('change', filterBreweries);
    document.getElementById('ratingFilter').addEventListener('change', filterBreweries);

    // Add New Brewery Feature
    document.getElementById('addBreweryButton').addEventListener('click', function() {
        document.getElementById('addBreweryModal').classList.remove('hidden');
        // Set default date to today for visit date
        document.getElementById('newBreweryVisitDate').value = new Date().toISOString().split('T')[0];
    });
    
    document.getElementById('closeAddBreweryModal').addEventListener('click', function() {
        document.getElementById('addBreweryModal').classList.add('hidden');
    });
    
    // Show/hide "Other" state field based on state selection
    document.getElementById('newBreweryState').addEventListener('change', function() {
        if (this.value === 'other') {
            document.getElementById('otherStateContainer').classList.remove('hidden');
        } else {
            document.getElementById('otherStateContainer').classList.add('hidden');
        }
    });
    
    // Show/hide visit date based on visited checkbox
    document.getElementById('newBreweryVisited').addEventListener('change', function() {
        document.getElementById('newBreweryVisitDateContainer').style.display = this.checked ? 'block' : 'none';
    });
    
    // Get coordinates from address using geocoding
    document.getElementById('geolocateAddress').addEventListener('click', async function() {
        const address = document.getElementById('newBreweryAddress').value;
        if (!address) {
            showToast('Please enter an address first.', 'error');
            return;
        }
        
        try {
            // Show loading state
            this.disabled = true;
            this.innerHTML = '<div class="spinner inline-block mr-2" style="width: 16px; height: 16px;"></div> Getting coordinates...';
            
            // Nominatim geocoding API (OpenStreetMap)
            const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}`);
            const data = await response.json();
            
            if (data && data.length > 0) {
                const lat = parseFloat(data[0].lat);
                const lng = parseFloat(data[0].lon);
                
                document.getElementById('newBreweryLat').value = lat;
                document.getElementById('newBreweryLng').value = lng;
                
                // Center map on the location
                map.setView([lat, lng], 15);
                
                // Add a temporary marker
                const tempMarker = L.marker([lat, lng]).addTo(map);
                tempMarker.bindPopup(`<b>New Location</b><br>${address}`).openPopup();
                
                // Remove marker after 5 seconds
                setTimeout(() => map.removeLayer(tempMarker), 5000);
                
                showToast('Coordinates obtained successfully!', 'success');
            } else {
                showToast('Could not find coordinates for the provided address. Please enter coordinates manually.', 'error');
            }
        } catch (error) {
            console.error('Error geocoding address:', error);
            showToast('Error getting coordinates. Please enter them manually.', 'error');
        } finally {
            // Reset button
            this.disabled = false;
            this.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 inline-block mr-1" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clip-rule="evenodd" /></svg> Get Coordinates from Address';
        }
    });
    
    // Add new brewery
    document.getElementById('addNewBrewery').addEventListener('click', function() {
        // Validate form
        const name = document.getElementById('newBreweryName').value.trim();
        const city = document.getElementById('newBreweryCity').value.trim();
        let state = document.getElementById('newBreweryState').value;
        const address = document.getElementById('newBreweryAddress').value.trim();
        const lat = parseFloat(document.getElementById('newBreweryLat').value);
        const lng = parseFloat(document.getElementById('newBreweryLng').value);
        const rank = parseInt(document.getElementById('newBreweryRank').value) || breweries.length + 1;
        const visited = document.getElementById('newBreweryVisited').checked;
        const visitDate = visited ? document.getElementById('newBreweryVisitDate').value : null;
        const notes = document.getElementById('newBreweryNotes').value.trim();
        const flagshipBeer = document.getElementById('newBreweryFlagshipBeer').value.trim();
        
        // Check if state is "other" and get custom state
        if (state === 'other') {
            state = document.getElementById('otherState').value.trim();
            if (!state) {
                showToast('Please enter a state name.', 'error');
                return;
            }
        }
        
        // Validate required fields
        if (!name) {
            showToast('Please enter a brewery name.', 'error');
            return;
        }
        
        if (!city) {
            showToast('Please enter a city.', 'error');
            return;
        }
        
        if (!state) {
            showToast('Please select a state.', 'error');
            return;
        }
        
        if (!address) {
            showToast('Please enter an address.', 'error');
            return;
        }
        
        if (isNaN(lat) || isNaN(lng)) {
            showToast('Please enter valid coordinates. You can use the "Get Coordinates from Address" button to automatically fill these in.', 'error');
            return;
        }
        
        // Create new brewery object
        const newBrewery = {
            name,
            rank,
            city,
            state,
            address,
            lat,
            lng,
            visited,
            visitDate,
            notes,
            flagshipBeer,
            distance: 0, // Default distance
            ratings: { KC: 0, Jeff: 0, Dave: 0 },
            avgRating: 0,
            untappdURL: '',
            isCustom: true // Mark as custom brewery
        };
        
        // Add to breweries array
        breweries.push(newBrewery);
        
        // Create marker
        const marker = createBreweryMarker(newBrewery);
        marker.addTo(map);
        markers.push({ marker, brewery: newBrewery });
        
        // Create list item
        const listItem = createBreweryListItem(newBrewery);
        document.getElementById('breweryList').appendChild(listItem);
        
        // Save to localStorage
        saveToStorage();
        
        // Update stats
        updateStatsUI(calculateStats(breweries));
        
        // Reset form
        document.getElementById('newBreweryName').value = '';
        document.getElementById('newBreweryRank').value = '';
        document.getElementById('newBreweryCity').value = '';
        document.getElementById('newBreweryState').value = '';
        document.getElementById('newBreweryAddress').value = '';
        document.getElementById('newBreweryLat').value = '';
        document.getElementById('newBreweryLng').value = '';
        document.getElementById('newBreweryVisited').checked = false;
        document.getElementById('newBreweryVisitDateContainer').style.display = 'none';
        document.getElementById('newBreweryNotes').value = '';
        document.getElementById('newBreweryFlagshipBeer').value = '';
        document.getElementById('otherStateContainer').classList.add('hidden');
        
        // Close modal
        document.getElementById('addBreweryModal').classList.add('hidden');
        
        showToast(`${name} has been added to your brewery list!`, 'success');
        
        // Center map on new brewery
        map.setView([lat, lng], 12);
        
        // Re-setup swipe listeners
        setupSwipeListeners();
    });
    
    // Set up mobile view toggle
    setupMobileViewToggle();
    
    // Set up iOS-specific button enhancements
    enhanceMobileButtons();
    
    // Set up current location button
    setupCurrentLocation();
    
    // Set up pull-to-refresh
    setupPullToRefresh();
}

// Initialize the app
async function initApp() {
    try {
        showLoading("Loading brewery data...");
        
        // Load sync settings
        loadSyncSettings();
        
        // Load brewery data
        breweries = await loadBreweryData();
        
        // Initialize the map
        initializeMap();
        
        // Initialize breweries on the map and in the list
        initializeBreweries();
        
        // Set up event listeners
        setupEventListeners();
        
        // Set up auto-sync
        setupAutoSync();
        
        hideLoading();
    } catch (error) {
        console.error("Error initializing app:", error);
        hideLoading();
        showToast("An error occurred while loading the app. Please try again.", "error");
    }
}

// Start the app when the DOM is loaded
document.addEventListener('DOMContentLoaded', initApp);
