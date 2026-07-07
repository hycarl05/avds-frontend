export const validateLocationData = (data) => {
    const errors = {};

    if (!data.name?.trim()) {
        errors.name = 'Location name is required';
    }

    if (!data.lat || isNaN(parseFloat(data.lat))) {
        errors.lat = 'Valid latitude is required';
    }

    if(!data.lng || isNaN(parseFloat(data.lng))) {
        errors.lng = 'Valid longitude is required';
    }

    if (!['online', 'offline', 'warning'].includes(data.status)) {
        errors.type = 'Valid type is required';
    }

    if(!['cctv', 'vms', 'avds'].includes(data.type)) {
        errors.type = 'Valid type is required';
    }

    return {
        isValid: Object.keys(errors).length === 0,
        errors
    };
};
