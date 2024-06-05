from django.contrib.auth.decorators import login_required
from django.contrib.auth.models import User, Group
import jwt, requests, json
from django.utils import timezone
from django.conf import settings
from django.shortcuts import render, redirect
from django.http import HttpRequest, HttpResponse, HttpResponseBadRequest, JsonResponse, HttpResponseRedirect
from django_otp.plugins.otp_totp.models import TOTPDevice
import qrcode
import base64
from io import BytesIO
from django.core.exceptions import ObjectDoesNotExist
from django.views.decorators.csrf import csrf_exempt

from frontapp.models import Player


#Login Required Wrapper
def login_required(callable):
    def wrapper(request: HttpRequest) -> HttpResponse:
        if (session := request.COOKIES.get('session', None)) == None:
            return render(request, 'login.html')
        try:
            data = jwt.decode(session, settings.JWT_SECRET, algorithms=['HS256'])
        except:
            return HttpResponseBadRequest('Invalid session')
        if data['2FA_Activated'] and not data['2FA_Passed']:
            return render(request, 'otp_login.html')
        return callable(request, data)
    return wrapper

#Simple Website Renderer Functions
def otp_login(request: HttpRequest) -> HttpResponse:
    return render(request, 'otp_login.html')

def index(request: HttpRequest) -> HttpResponse:
    return render(request, 'index.html')

@login_required
def tournament(request, data):
    return render(request, 'tournament.html')

def login(request):
    return render(request, 'login.html')

def play_pong(request):
    if request.headers.get('x-requested-with') == 'XMLHttpRequest':
        return render(request, 'play_pong.html')
    return render(request, 'base.html')

def login_with_2FA(request):
    return render(request, 'login_with_2FA.html')

@login_required
def learn_view(request, data):
    return render(request, 'learn.html')

@login_required
def profile_view(request, data):
    return render(request, 'profile.html')

def root_view(request):
    return render(request, 'root.html')

@login_required
def enable_otp_page(request, data):
    return render(request, 'enable_otp.html')

def logout(request):
    response = redirect('home')
    response.delete_cookie('session') 
    return response

def rank_list(request):
    players = Player.objects.all().order_by('-points')
    ranking = [{'name': player.name, 'points': player.points, 'wins': player.wins, 'losses': player.losses} for player in players]
    return render(request, 'rank_list.html', {'ranking': json.dumps(ranking)})


#Authentication/API related Functions

def auth(request: HttpRequest) -> HttpResponse:
    if (code := request.GET.get('code')) == None:
        return HttpResponseBadRequest()
    oauth_response = requests.post('https://api.intra.42.fr/oauth/token', data={
        'code': code,
        'grant_type': 'authorization_code',
        'client_id': settings.OAUTH2_CLIENT_ID,
        'client_secret': settings.OAUTH2_SECRET,
        'redirect_uri': 'http://127.0.0.1:8000/auth'
    }).json()

    user_info = requests.get('https://api.intra.42.fr/v2/me', headers={
        'Authorization': 'Bearer ' + oauth_response['access_token']
    }).json()

    session_token = {
        'access_token': oauth_response['access_token'],
        '2FA_Activated': False,
        '2FA_Passed': False,
    }
    intra_name = user_info['login']
    if intra_name:
        user, created = User.objects.get_or_create(username=intra_name)
        group = Group.objects.get(name='2FA-activated')
        is_member = user.groups.filter(id=group.id).exists()
        if is_member:
            response = HttpResponseRedirect('/') # redirect to otp login page
            response.headers['Content-Type'] = 'text/html'
            session_token['2FA_Activated'] = True
            response.set_cookie('session', jwt.encode(session_token, settings.JWT_SECRET, algorithm='HS256'))
            return response
        else:
            response = HttpResponseRedirect('/')
            response.headers['Content-Type'] = 'text/html'
            response.set_cookie('session', jwt.encode(session_token, settings.JWT_SECRET, algorithm='HS256'))
            return response
    else:
        return HttpResponse({'error': 'Username is not provided'}, status=400)

@login_required
def get_user_info(request: HttpRequest, data: dict) -> HttpResponse:
    response = requests.get('https://api.intra.42.fr/v2/me', headers={
        'Authorization': 'Bearer ' + data['access_token']
    })
    return JsonResponse(response.json(), safe=False)

@login_required
def get_user_info_dict(request: HttpRequest, data: dict) -> dict:
    user_info = get_user_info(request)
    user_info_dict = json.loads(user_info.content.decode('utf-8'))
    return user_info_dict

def home(request):
    if request.headers.get('x-requested-with') == 'XMLHttpRequest':
        return render(request, 'home.html')
    session = request.COOKIES.get('session', None)   
    isAuthenticated = False
    try:
        data = jwt.decode(session, settings.JWT_SECRET, algorithms=['HS256'])
        isAuthenticated = True
    except:
        isAuthenticated = False
    return render(request, 'base.html', {
        'user': {
            'is_authenticated': isAuthenticated
        }
    })


#OTP Functions

@login_required
def enable_otp(request, data):
    user_info = get_user_info_dict(request)
    intra_name = user_info['login']
    if intra_name:
        user, created = User.objects.get_or_create(username=intra_name)
        device, created = TOTPDevice.objects.get_or_create(user=user, name='default')
        if created:
            uri = device.config_url
            qr = qrcode.make(uri)
            buf = BytesIO()
            qr.save(buf, format='PNG')
            image_base64 = base64.b64encode(buf.getvalue()).decode('utf-8')
            return JsonResponse({'uri': uri, 'qr_code': image_base64})
        elif device:
            uri = device.config_url
            qr = qrcode.make(uri)
            buf = BytesIO()
            qr.save(buf, format='PNG')
            image_base64 = base64.b64encode(buf.getvalue()).decode('utf-8')
            return JsonResponse({'uri': uri, 'qr_code': image_base64})
    else:
        return JsonResponse({'error': 'Username is not provided'}, status=400)
      
@login_required
def verify_otp(request, data):
    user_info = get_user_info_dict(request)
    intra_name = user_info['login']

    body_unicode = request.body.decode('utf-8')
    body_data = json.loads(body_unicode)
    otp = body_data.get('otp')
    
    user = User.objects.get(username=intra_name)
    device = user.totpdevice_set.first()
    print(otp)
    print(user)
    group = Group.objects.get(name='2FA-activated')  
    if device is None:
        return HttpResponse('No TOTPDevice associated with this user')
    if device.verify_token(otp):
        # OTP is valid
        group.user_set.add(user)
        return HttpResponse('OTP is valid')
    else:
        # OTP is invalid
        return HttpResponse('OTP is invalid')
    
@login_required
def remove_all_otp_devices(request, data):
    user_info = get_user_info_dict(request)
    intra_name = user_info['login']
    if intra_name:
        try:
            group = Group.objects.get(name='2FA-activated')  
            user = User.objects.get(username=intra_name)
            TOTPDevice.objects.filter(user=user).delete()
            group.user_set.remove(user)
            return HttpResponse({"All OTP devices have been removed.".format(intra_name)})
        except User.DoesNotExist:
            return HttpResponse({'error': "User {} does not exist.".format(intra_name)}, status=400)
        
@csrf_exempt
def login_with_otp(request):
    
    encoded_session = request.COOKIES['session']
    session = jwt.decode(encoded_session, settings.JWT_SECRET, algorithms=['HS256'])
    user_info = requests.get('https://api.intra.42.fr/v2/me', headers={
        'Authorization': 'Bearer ' + session['access_token']
    }).json()

    if not user_info:
        return HttpResponse('No user info found')
    intra_name = user_info['login']
  

    body_unicode = request.body.decode('utf-8')
    body_data = json.loads(body_unicode)
    otp = body_data.get('otp')
    
    user = User.objects.get(username=intra_name)
    device = user.totpdevice_set.first()
    print(otp)
    print(user)
    group = Group.objects.get(name='2FA-activated')  
    if device is None:
        return HttpResponse('No TOTPDevice associated with this user')
    if device.verify_token(otp):
        # OTP is valid
        response = HttpResponse('OTP is valid')
        session['2FA_Passed'] = True
        response.set_cookie('session', jwt.encode(session, settings.JWT_SECRET, algorithm='HS256'))
        return response
    else: 
        # OTP is invalid
        return HttpResponse('OTP is invalid')
    
