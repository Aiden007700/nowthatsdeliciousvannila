function autoComplete(input, lat, lng) {
    if(!input) return
    const dropdown= new google.maps.places.Autocomplete(input)
    dropdown.addListener('place_changed', () => {
        const place = dropdown.getPlace()
        lat.value = place.geometry.location.lat();
        lng.value = place.geometry.location.lng();
    });
    input.on('keydown', (e) => {
        if(e.keyCode === 13) e.preventDefault();
    })
}

export default autoComplete