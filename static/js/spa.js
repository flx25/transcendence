document.addEventListener('DOMContentLoaded', function() {
    document.querySelectorAll('a.nav-link').forEach(function(link) {
        link.addEventListener('click', function(event) {
            event.preventDefault(); // Prevent the default link behavior
            
            const url = link.getAttribute('href'); // Get the URL from the link's href attribute
            console.log("Fetching data from:", url);
            
            // Fetch the content of the page using the URL
            urlnew = url.replace("#", "");
            urlnew = urlnew + ".html"
            fetch(urlnew, {
                headers: {
                    'X-Requested-With': 'XMLHttpRequest'
                }
            })
            .then(response => response.text())
            .then(data => {
                console.log("Received data:", data);
                
                // Update the desired object with the fetched content
                const targetObject = document.getElementById('main-content'); // Replace 'learn-content' with the ID of the object
                if (targetObject) {
                    targetObject.innerHTML = data;
                    const scriptElements = targetObject.getElementsByTagName('script');
                    for (let index = 0; index < scriptElements.length; index++)
                        eval(scriptElements[index].innerHTML);
                } else {
                    console.error("Target object not found");
                }
                
                // Optionally, update the URL in the address bar
                history.pushState(null, '', url);
                
                // Call the updatePendingFriendRequests function
                checkPendingFriendRequests();
            })
            .catch(error => {
                console.error("Error fetching data:", error);
            });
        });
    });

      // Event listener for when the user navigates backward or forward
      window.addEventListener('popstate', function(event) {
        console.log("Popstate event triggered.");
        
        // Fetch the content of the previous or next page
        const url = window.location.href;

        urlnew = url.replace("#", "");
        urlnew = urlnew + ".html";
        console.log("Fetching data from:", urlnew);
        fetch(urlnew, {
            headers: {
                'X-Requested-With': 'XMLHttpRequest'
            }
        })
        .then(response => response.text())
        .then(data => {
            console.log("Received data:", data);
            checkPendingFriendRequests();
            // Update the desired object with the fetched content
            const targetObject = document.getElementById('main-content'); // Replace 'learn-content' with the ID of the object
            if (targetObject) {
                targetObject.innerHTML = data;
                const scriptElements = targetObject.getElementsByTagName('script');
                for (let index = 0; index < scriptElements.length; index++)
                    eval(scriptElements[index].innerHTML);
            } else {
                console.error("Target object not found");
            }
        })
        .catch(error => {
            console.error("Error fetching data:", error);
        });
    });
    
});

function generate_otp_QR()
{
    console.log('Button clicked');
    fetch('/enable_otp/')
        .then(response => {
            console.log('Received response', response);
            return response.json();
        })
        .then(data => {
            console.log('Received data', data);
            const img = document.getElementById('qr-code');
            img.src = 'data:image/png;base64,' + data.qr_code;
            img.style.display = 'block';
        })
        .catch(error => {
            console.error('Error:', error);
        });
}

function send_otp_code()
{
    const otp = document.getElementById('otp-input').value;
        
    fetch('/verify_otp/', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': getCookie('csrftoken')
        },
        body: JSON.stringify({ otp: otp })
    })
    .then(response => response.text())
    .then(data => {
        console.log('Received data', data);
        alert(data);
        if (data === 'OTP is valid') {
            window.location.href = '/';
        }
    })
    .catch(error => {
        console.error('Error:', error);
    });

}

function send_otp_code_login()
{
    const otp = document.getElementById('otp-input').value;
        
    fetch('/login_with_otp/', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': getCookie('csrftoken')
        },
        body: JSON.stringify({ otp: otp })
    })
    .then(response => response.text())
    .then(data => {
        console.log('Received data', data);
        alert(data);
        if (data === 'OTP is valid') {
            window.location.href = '/';
        }
    })
    .catch(error => {
        console.error('Error:', error);
    });

}

function getCookie(name){

    let cookieValue = null;
    if (document.cookie && document.cookie !== '') {
        const cookies = document.cookie.split(';');
        for (let i = 0; i < cookies.length; i++) {
            const cookie = cookies[i].trim();
            if (cookie.substring(0, name.length + 1) === (name + '=')) {
                cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
                break;
            }
        }
    }
    return cookieValue;
}


function changeInfoSave() {
    const avatarUrlField = document.getElementById('avatarUrl');
    const avatarFileField = document.getElementById('avatarFile');
    const formData = new FormData();
    formData.append('displayName', document.getElementById('displayName').value);
    if (avatarFileField.files[0]) {
        formData.append('avatarFile', avatarFileField.files[0]);
    }
    if (avatarUrlField.value) {
        formData.append('avatarUrl', avatarUrlField.value);
    }
    fetch('/change_info/', {
        method: 'POST',
        headers: {
            'X-CSRFToken': getCookie('csrftoken')
        },
        body: formData
    })
    .then(response => response.json())
    .then(response => {
        if (response.success) {
            alert(gettext('Info changed successfully, refresh site for avatar changes to take effect!'));
        } else {
            alert(gettext('Error changing info! : ') +response.reason);
        }
    });
}

function addFriend(event) {

    event.preventDefault();
   
    var formData = new FormData(event.target);

    
    fetch('/send_friend_request/', {
        method: 'POST',
        body: formData,
        headers: {
            'X-CSRFToken': getCookie('csrftoken')
        }
    })
    .then(response => response.json())
    .then(data => {

        if (data.success) {
            alert(gettext('Friend request sent successfully!'));
        } else {
            alert(gettext('Error sending friend request: ') + data.error);
        }
    })
    .catch(error => {
        console.error('Error:', error);
        alert(gettext('An error occurred while sending the friend request.'));
    });
}

function acceptFriendRequest(userIntraName, friendUsername) {
    fetch('/accept_friend_request/', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'X-CSRFToken': getCookie('csrftoken')  
        },
        body: 'user_intra_name=' + userIntraName + '&friend_username=' + friendUsername
    })
    .then(response => response.json())
    .then(data => {
        if (data.status === 'success') {
            alert(gettext('Friend request accepted successfully!'));
            window.location.reload();
        }
    });
}

function declineFriendRequest(userIntraName, friendUsername) {
    fetch('/decline_friend_request/', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'X-CSRFToken': getCookie('csrftoken')  
        },
        body: 'user_intra_name=' + userIntraName + '&friend_username=' + friendUsername + '&remove=false'
    })
    .then(response => response.json())
    .then(data => {
        if (data.status === 'success') {
            alert(gettext('Friend request declined successfully!'));
            window.location.reload();
        }
    });
}

function removeFriend(userIntraName, friendUsername) {
    fetch('/decline_friend_request/', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'X-CSRFToken': getCookie('csrftoken')  
        },
        body: 'user_intra_name=' + userIntraName + '&friend_username=' + friendUsername + '&remove=true'
    })
    .then(response => response.json())
    .then(data => {
        if (data.status === 'success') {
            alert(gettext('Friend removed successfully!'));
            window.location.reload();
        }
    });
}

function checkPendingFriendRequests() {
    fetch('/get_pending_friend_requests/', {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': getCookie('csrftoken')  
        },
    })
    .then(response => response.json())
    .then(data => {
        if (data.length > 0) {
            alert(gettext('You have a pending friend requests, refresh the site in order to see it!'));
        }
    });
}