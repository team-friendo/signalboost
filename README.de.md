# Signalboost

Hi! Dieses Dokument dient primär als Entwickler orientiertes Dokument. Wenn du weniger Jargon bevorzugst, wirf einen blick auf [https://signalboost.info](https://signalboost.info)

_In einer anderen Sprache lesen:_ [English](https://0xacab.org/divan/signalboost/-/blob/master/README.md)

## Inhaltsverzeichnis:

* [Übersicht](#übersicht)
* [Application Design](#design)
* [Mitentwickeln] (#developer-guide)
* [Das Signalboost CLI Tool](#cli)
* [Systemadmin Guide](#sysadmin-guide)
  * [Generelle Deployment Anleitung](#deploy-public)
  * [Deployment Anleitung für Team Friendo]#deploy-team-friendo)

# Übersicht <a name="übersicht"></a>

**Signalboost** ist ein Schnelleingreif Tool von und für ActivistiX Es ermöglicht den Benutzern umsonst verschlüsselte Text Warnungen über den [Signal messaging Service](https://www.signal.org/) an eine massen TeilnehmerInnen Liste zu senden ohne die Nummer der AbsenderIn oder der EmpfängerIn einander preiszugeben. Du könntest es benutzen um Notfall Nachrichten zu verschicken, mobi updates, dringene hilfrufe, oder in anderen kreativen Fällen an die wir nie gedacht haben :) [1](#txtmob_witz)]

**Der Stack** besteht aus node services welche die [signald](https://git.callpipe.com/finn/signald) Java app über unix sockets aufrufen.Siehe [Application Design](#design) für eine detailierte Übersicht

**Bug Reports und Problemmanagement** sind auf [unserer gitlab repo auf 0caxab.org](https://0xacab.org/team-friendo/signalboost)  **Laufende arbeiten** kannst du auf dem [kanban board](de/team-friendo/signalboost/boards) des Projekts verfolgen.

**Du möchtest signalboost für soziala Gerechtigkeit einsetzen?** schreibe an `team-friendo [AT] riseup [DOT] net` ([pgp key hier](https://pgp.mit.edu/pks/lookup?op=get&search=0xE726A156229F56F1)) um nach einem einen signalboost Kanal für deine Gruppe zu fragen. Wir freuen uns auch dir dabei zu helfen herauszufinden wie du deine eigene signalboost Instanz auf einem Serven zum laufen bringen und unterhalten kannst damit du deinen eigenen Kanal betreiben kannst und nicht tem-friendo deine Teilnehmer Liste(n) anvertrauen musst. :)

**Anmerkung: dieses Projekt ist nicht offiziell der Signal App oder Foundation angehörig** Wir sind blos einige tolle bescheidene techies die versuchen unseren Freunden zu helfen. Wir sind Moxie und der Signal Foundation dafür dankbar dass sie ein großzügiges freies/offenes Ökosystem unterhalten, dass so etwas möglich macht<@3
__________________

<a name="txtmob_witz"></a>
[1] *Wenn du ein Berliner Anarcho Kind der 90er bist , stell dir signalboost wie die AHOI-Liste aber auf Signal vor. Oder wenn du "noch" im Email-Zeitalter bist wie Schleuder-Listen aber über Signal. Wenn du in die digitale Welt geboren wurdest, versuchs mit " wie Signal aber mit Verteilerliste"

# Application Design <a name="design"></a>

##Datenfluss

Das folgende ist im groben der Datenfluss durch die App:

* ein Anwendungsserver kontrolliert mehrere signal nummern, die jeweils als ein "kanal" fungieren
* Admins und Teilnehmer können mit dem Kanal interagieren in dem sie Befehle in form einer Signalnachricht schicken zB:
Benutzer können sich für einen Kanal als Teilnehmer hinzufügen oder entfernen indem sie eine Signal Nachricht mit dem Text "HALLO" oder respektive "TSCHÜSS" senden. **Publisher** können andere **Publisher** hinzufügen indem sie eine nachricht mit dem Text "ADD +491701234567" , usw. senden
* wenn ein Publisher eine Nachricht die kein Befehl ist an einen Kanal sendet , wird diese Nachricht allen Teilnehmern dieses Kanals übermittelt.
* anders als mit Signal Gruppen:
  * erscheint die Nachricht bei den Teilnehmern unter der mit dem Kanal assozierten Nummer (nicht der Nummer des Publishers)
  * können Teilnehmer nicht die Nummern der anderen Teilnehmer sehen
  * können Teilnehmer nicht auf Nachrichten antworten
* anders als mit anderen Verteilern:
  * ist der Nachrichtenversand gratis (danke m0xie!)
  * sind alle Nachrichten zwischen **Publishern** und der Anwendungs und zwischen der Anwendung und den Teilnehmern verschlüsselt (ANMERKUNG: sie werden kurzzeitig in der Anwendung entschlüsselt und neuverschlüsselt aber nicht permanent auf der Festplatte gespeichert
  * können **Publisher** Teilnehmern Anhänge schicken
+ anzumerken ist dass zur Zeit die Liste der Teilnehmer auf der Festplatte des Signalboost Servers hinterlegt ist: wenn dich das nervös macht kannst du:
  * deine eigene signalboost Instanz hosten (siehe Anleitung unten)
  * dein Bedürfnis nach der implementierung von verschlüsselten Teilnehmerlisten im Problemmanagement[7](https://0xacab.org/team-friendo/signalboost/issues/68) anmelden

##Architektur

Die Anwendung besteht aus den folgenden Komponenten:

1. eine `db` ebene mit
  * `phoneNumbersRepository`: das Telefonnummernverzeichnis verfolgt welche twilio nummern gekauft wurden, ob sie mit Signal registriert wurden und ob sie bereits einem Kanal zugeordnet sind
  * `channelsRepository`: das Kanalverzeichnis hält fest welche Kanäle auf welcher Telefonnummer existieren und welche Nummern darauf publizieren können und als Teilnehmer angemeldet sind
2. ein `registrar` Dienst der:
  * nach Twilio Nummern sucht und diese kauft
  * twillio Nummern mit Signal registrier
  * Verifizierungs Codes zum Signal server schickt (nachdem sie als sms Nachricht vom signal server and twilio geschickt, und an die app über einen eingehenden `/twilioSms` webhook weitergeleitet wurden
  *  erstellt Kanäle und fügt Telefonnummern, **Publisher**, und Teilnehmer hinzu/entfernt sie von diesen
3. ein `dispatcher` Dienst der eingehende Nachrichten auf jedem Kanal über eine unix socket Verbindung zu `signald` liest, und dann die jeweiligen Nachrichten bearbeitet mit:
  * dem `executor` Unterdienst, dieser analysiert nachrichten auf der suche nach Befehlen (z.B.: `ADD` admin ( füge admin zu Kanal hinzu) , wenn es einen findet, führt es den Befehl aus und schickt eine Antwort zurück
  *  dem `messenger`Unterdienst bedient den output des executor. Wenn er eine Antwortnachricht sieht schickt er sie an die Befehlsabsenderin. Sonst schickt er eingehende Nachrichten an alle Kanalteilnehmer , solange die Zugangsregeln das erlauben.


 Mitentwickeln <a name="#developer-guide"></a>

Wir freuen uns sehr dass du mithelfen möchtest Code für Signalboost zu schreiben!

Bitte lese dir als erstes die `CONTRIBUTING.md` Datei durch, die sich HIER befindet:

https://0xacab.org/team-friendo/signalboost/blob/master/CONTRIBUTING.md

Dann willst du warscheinlich mehr wissen über ...

## Erste Schritte

Zunächst musst du die Repo Clonen:

``` shell
git clone git@0xacab.org:team-friendo/signalboost
cd signalboost
```

Damit du Signalboost mitentwickelnd kannst solltest du zunächst sicherstellen, dass auf deinem Rechner folgende Programme installiert sind:

* make (ist wascheinlich vorhanden. überprüfe mit `which make`. wenn das eine ausgabe produziert: hast dus!)
* docker CE
* docker-compose
* jq

Wenn du einzelnde unit test auf deinem Computer laufen lassen möchtest, brauchst du auch folgendes:

* node
* postgresql

Um diese auf einem Debian Laptop zu installieren must du folgende Befehle ausführen:

``` shell
sudo apt-get install \
     apt-transport-https \
     ca-certificates \
     curl \
     gnupg2 \
     software-properties-common
curl -fsSL https://download.docker.com/linux/debian/gpg | sudo apt-key add -
# überprüfe dass der Fingerprint mit Folgendem übereinstimmt 9DC8 5822 9FC7 DD38 854A  E2D8 8D81 803C 0EBF CD88, then:
sudo apt-key fingerprint 0EBFCD88
sudo add-apt-repository \
   "deb [arch=amd64] https://download.docker.com/linux/$(lsb_release -is | tr '[:upper:]' '[:lower:]') \
   $(lsb_release -cs) \
   stable"
sudo apt-get update
sudo apt-get install docker-ce jq nodejs postgresql
pip install docker-compose
```

Auf einem Mac (getestet auf 10.14.5 Mojave), sähe das so aus:

``` shell
brew update
brew install docker docker-compose jq node postgresql
brew cask install docker
```

(Anmerkung: Die `cask` version von docker erlaubt es dir docker aus dem Anwendungs Ordner zu starten und gibt dir ein schickes systray icon. Einige Entwickler*innen berichten, dass sie so vergehen mussten um eine funktionierende Entwicklungsumgebung zu erhalten! :))

## Geheimnisse <a name="secrets"></a>

Nach dem Clonen der Repo , einen der folgenden Vorgänge ausführen um die zum ausführen von signalboost fehlenden Umgebungsvariablen hinzuzuziehen:

### Geheimnisse für Jede/n

Du must deine Eigenen Werte für die Zugangsdaten die unter `.env` aufgelistet sind einführen. Ein Beispiel der benötigten Werte gibt es in `env.example`. Alle werte mit `%Template_STRINGS` musst du mit eigenen ersetzen

Uns ist beswusst dass einige dieser Geheimnisse bezahlaccounts vorraussetzen um zu funktionieren. Um an diesem Projekt mitwirken zu können sollte das nicht von nöten sein! Wir arbeiten an einer Lösunge... 

Bis dahin sind Vorschläge sehr willkommen! :)

### Geheimnisse für Team Friendo Mitglieder <a name="team-friendo-secrets"></a>

Wir nutzen [blackbox](https://github.com/StackExchange/blackbox) um Geheimnisse unter verschlüsselter Versionskontrolle zu halten.

Um das nutzen zu können, musst du zunächst deinen gpg Schlüssel auf die whitelist setzen:

* [erstelle dir einen funktionierenden PGP Schlüssel](http://irtfweb.ifa.hawaii.edu/~lockhart/gpg/) falls du nicht schon einen hast
* hole die den Fingerprint deines öffentlichen Schlüssels (zB. mit, `gpg -K`)
* schicke den Fingerprint deines öffentlichen PGP Schlüssel an eine.n signalboost maintainer und bitte sie dich zur blackbox whitelist der akzeptierten pgp Schlüssel hinzuzufügen

Jetzt wo du auf der whitelist bist kannst du blackbox nutzen um Geheimnisse zu entschlüsseln und zu sourcen mit:

```
cd pfad/zu/signlaboost/
./bin/blackbox/decrypt_all_files
```

Oder... wenn du etwas leichter zu merkendes bevorzugst als `./bin/blackbox/blah-blah-blah`, führe folgendes aus:

``` shell
make _.unlock
```

**VORSICHT :** if you are running an older version of debian or ubuntu (which defaults to gpg v1 instead of gpg v2), you will get inscrutable errors when trying to invoke blackbox. This can be fixed by installing `gpg2` and then invoking blackbox with `GPG=gpg2 ./bin/blackbox/decrypt_all_files**

## Makefile

Wir haben viele scripts die mit der App helfen, sie sind alle in der `Makefile` der Repo definiert. Mit folgendem Befehl kannst du sie dir anzeigen lassen:

``` shell
make help
```

Wenn du `make` eintippst und dann `TAB` drückst, wird dir autocomplete Vorschläge für was auch immer du bereits eingegeben hast geben.

Lass uns ein paar make Befehle ausführen um die Entwicklungsumgebung aufzusetzen! :)

## Setup

Folgendes wird Signalboost's Docker Container bauen, die nötigen node Abhängigkeiten installieren, die Datenbanken bauen und migrieren:


``` shell
make _.setup
```

## Tests Durchführen

``` shell
make test.all
```

Wenn gewünscht kannst du unit und e2e tests getrennt durchführen:

``` shell
make test.unit
```

``` shell
make test.e2e
```

## App Starten

Die App im Entwicklermodus starten mit:

``` shell
make dev.up
```

## App Stoppen

Die App ordentlich herunterfahren (kann eine Weile dauern bis alle Container heruntergefahren sind):

``` shell
make dev.down
```

Um alle Container zum sofortigen Shutdown zu zwingen:

``` shell
make dev.abort
```


## Seed Data

Das `boost` cli Werkzeug muss installiert sein um Nummern und Kanäle zu seeden.

Schau in den [Das Signalboost CLI Tool](#cli) Abschnitt für Hinweise zur Installation und Benutzung!

Ist das CLI Tool einmal installiert, kannst du folgendes ausführen um 2 twillio Nummern zu erstellen und diese mit Signal auf deinem Lokalen Development Server mit signalboost zu verifizieren:

``` shell
make dev.up
boost create-number -n 2 -u signalboost.ngrok.io -u signalboost.ngrok.io
```

Schaun wir nach der ersten Nummer die dadurch ausgegeben wird. Nennen wir sie <channel_phone_number>. Jetzt rufen wir deine eigene tatsächliche Signal Nummer<your_actual_phone_number> an.

Mit folgendem Befehl kannst du einen Kanal mit der Nummer <channel_phone_number> und deiner tatsächlichen Nummer <your_actual_phone_number> als Admin erstellen:


```shell
boost create-channel \
    -p <channel_phone_number> \
    -n "mein neuer Kanal" \
    -a <your_actual_phone_number> \
    -u signalboost.ngrok.io
```

### Benutzung der App

Mit laufender app...

Sollte jeder Mensch :

* Einem Kanal als Teilnehmer zutreten können durch Versand einer Signal Nachricht mit dem Inhalt "HALLO" an `$CHANNEL_PHONE_NUMBER` (die Telefonnummer des Kanals)
* Einen Kanal verlassen können durch Versand einer Signal Nachricht mit dem Inhalt "TSCHÜSS" an `$CHANNEL_PHONE_NUMBER` (die Telefonnummer des Kanals)

Jeder.m Admin sollte es möglich sein:

* Eine Nachricht an alle Kanalteilnehmer abzusetzen indem sie an `$CHANNEL_PHONE_NUMBER` (die Telefonnummer des Kanals) geschickt wird
* Alle Nachrichten die an den Kanal abgesetzt werden zu empfangen

### Datenbank Skripte

Es gibt ein paar Skripte um Dinge mit der der db zu tun:

Exekutiert alle anstehenden Migrationen (praktisch wenn ein.e andere Entwickler*in Migrationen erstellt hat die du noch nicht gestartet hast:
```shell
make db.migrate.up
```

Die Datenbank droppen (danach wirst du seed Daten wiederherstellen müssen):

```shell
make db.drop
```

Auf einen psql shell zugreifen (innerhalb des postgres docker containers für signalboost):

```shell
make db.psql
```

#Benutzung des CLI <a name="cli"></a>

Davon ausgehend das bereits Geheimnisse in `.env` hinterlegt sind (wie im Abschnitt [Geheimnisse

Das CLI Werkzeug installieren* mit:

```shell
make cli.install
```

(*Anmerkung: Das stellt die Befehle unter `signalboost/cli/boost-commands` in deinen $PATH indem es einen symlink zum `cli/boost` Verzeichnis in deinem `/usr/bin` Verzeichnis hinzufügt. Solltest du vorziehen das nicht zu tun kannst du das cli mit `signalboost/cli/boost` statt nur `boost` aufrufen oder es auf andrem Wege in $Path legen

Du kannst es später mit folgendem Befehl deinstallieren:

``` shell
make cli.uninstall
```

Jede laufende signalboost Instanz kann folgendermaßen administriert werden:

``` shell
boost <Befehl> <optionen>
```

Wobei `<Befehl>` einer der folgendes Befehle sein kann:

``` shell
   help 
      - zeigt diesen Dialog

  add-admin -c <channel phone number> -a <admin phone number> -u <url>
    - fügt eine.n Admin hinzu auf einem Kanal auf der Signalboost Instanz mit der url (defaults to prod!)

  create-channel -p <chan_phone_number> -n <chan_name> -a <admins> -u <api_url>
      - erstellt einen Kanal mit den gegebenen Telefonnummer, Name, und Absendern auf der signalboost Instanz mit der optional angegebenen url (defaults to prod!)

  create-number -a <area_code> -n <numbers_desired> -u <api_url>
      - kauft n neue twilio Nummern und registriert sie mit signal über registrar mit der optional angegebenen url

  list-channels -u <api_url>
    - gibt eine Liste aller auf der signalboost Instanz auf der optional angegebenen url aktiven Kanäle aus

  list-numbers -u <api_url>
      - gibt eine Liste aller von twilio gekauften Nummern aus die auf der signalboost Instanz auf der optional angegebenen url vorliegen 

   release_numbers <path>
      - stellt alle Telefonnummern mit den twilio ids die im gegebenen Pfad aufgelistet sind frei 
```

Für detailiertere Anweisungen zu einem Befehl folgendes ausführen

``` shell
boost <command> -h
```

# Sysadmin Guide <a name="sysadmin-guide"></a>

Want to help run an instance of signalboost on the official Team Friendo server or your own? Great! This section is for you!

It contains guides on system requirements you'll need to get started and two separate guides for people who want to run their own instances of signalboost ([Deploy Instructions for General Public](#deploy-public)) and Team Friendo members trying to learn how we deploy the mainline instance ([Deploy Instructions for Maintainers](#deploy-team-friendo))

The below is the shakiest part of this README! If you try anything below and it doesn't work, or you'd prefer it run a different way! Please open an issue/MR to help us fix it! We'd really appreciate the help!

## System Requirements

Um als sysadmin für eine Signalboost Instanz agieren zu können, brauchst du folgendes:

* ansible
* ansible-playbook
* verschiedene ansible regeln aus ansible-galaxy

Wenn du mit einem debian-aritgen Linux arbeitest, kannst du alle ansible Abhängigkeiten hiermit installieren:

``` shell
sudo apt-add-repository --yes --update ppa:ansible/ansible
sudo apt install ansible
cd path/to/signalboost
make ansible.install
```

Falls du auf einem andern System bist, [installiere ansible](https://docs.ansible.com/ansible/latest/installation_guide/intro_installation.html) und führe dann folgendes aus:

``` shell
ansible-galaxy install geerlingguy.docker
ansible-galaxy install geerlingguy.pip
ansible-galaxy install dev-sec.os-hardening
ansible-galaxy install dev-sec.ssh-hardening
```

## Generelle Deployment Anleitung <a name="deploy-public"></a>

Solltest du eine Person sein die diese Repo nicht unterhält **?** **verb von maintainer** , wollen wir, dass du deine eigene version von signalboost installieren und unterhalten kannst! Wir können aber nicht unsere Zugangsdaten und Server Infrastruktur mit dir teilen -- sorry!

Wir haben unseren Deployment prozess so ausgelegt, dass du ihn mit wenigen Modifikationen mit deinen eigenen Zugangsdaten und Infrasturktur anwenden kannst. (Sollte einer dieser Schritte nicht funktionieren, zögere bitte nicht eine Fehlermeldung zu posten damit wir das ändern können!)

**(1) Geheimnisse laden:**

Erstelle eine .env Datei wie die unter `env.example` zur Verfügung gestellte, aber ersetze die mit `%` Zeichen eingeklammerten Werte mit deinen eigenen Werten:

``` shell
# signal boost api service

SIGNALBOOST_HOST_IP=%IP ADDRESS OF PROD SERVER%
SIGNALBOOST_HOST_URL=%TOP LEVEL DOMAIN NAME FOR PROD SERVER%
SIGNALBOOST_API_TOKEN=%HEX STRING%

# letsencrypt/nginx proxy configs

VIRTUAL_HOST=%TOP LEVEL DOMAIN NAME FOR PROD SERVER%
LETSENCRYPT_HOST=%TOP LEVEL DOMAIN NAME FOR PROD SERVER%
LETSENCRYPT_EMAIL=%EMAIL ADDRESS FOR TEAM SYSADMIN%

# signal-cli

SIGNAL_CLI_VERSION=0.6.2
SIGNAL_CLI_PATH=/opt/signal-cli-0.6.2
SIGNAL_CLI_PASSWORD=%SOME STRONG PASSWORD%

# twilio

TWILIO_ACCOUNT_SID=%HEX STRING%
TWILIO_AUTH_TOKEN=%HEX STRING%


# ngrok (muss nur auf der local dev machine laufen, überspringen wenn der Server im prod Modus laufen soll )

NGROK_AUTH_TOKEN=%HEX_STRING%
NGROK_SUBDOMAIN=%NAME OF CUSTOM SUBDOMAIN REGISTERED WITH NGROK%

```

Um eine ausreichend zufällige 32-byte hex Zeichenfolge für deine `SIGNALBOOST_API_TOKEN` zu generieren könntest du folgendes tun :

``` shell
python
>>> import secrets
>>> secrets.token_hex(32)
```

Um twilio Konto Zugangsdaten zu bekommen, melde dich [hier](https://www.twilio.com/try-twilio) zu einem twilio account an, besuche dann die [console Seite](https://www.twilio.com/console) und suche nach den `ACCOUNT SID` und `AUTH TOKEN` Feldern rechterhand auf der Seite

Du brauchst nur einen `NGROK_AUTH_TOKEN` und `NGROK_SUBDOMAIN` falls du `signalboost` in einer lokalen Entwicklungsumgebung starten möchtest. (Schau [hier](https://dashboard.ngrok.com/user/signup) nach um einen ngrok account zu bekommen. Und [hier](https://dashboard.ngrok.com/reserved) um eine eigene reservierte Subdomin einzurichten

**(2) An einen Server kommen:**

Um signalboost zu hosten, brauchst du einen Server der:

* entweder auf einer Debian oder einer Ubuntu GNU/Linux distro läuft
* unter einer statischen IP Adresse zu erreichen ist
* eine Top-Level domain mit einem A record der auf die statische IP verweist hat

Wenn du Hilfe brauchst um einen Server zu finden, wir empfehlen dir nach einem VPS von einer der folgenen freundlichen social-justice orientierten Gruppen zu suchen:

- [Njalla](https://njal.la)
- [Greenhost](https://greenhost.nl)
- [1984](https://1984.is)
- [Mayfirst](https://mayfirst.org)

Was Domain Namen Registrierung angeht denken wir das [Njal.la](https://njal.la) schlicht die beste Option ist.

**(3)** Signalboost Provisionieren und Deployen

Dieser Schritt greift auf ansible zurück um einen Server zu provisionieren, installiert signalboost und alle Abhängigkeiten und konfiguriert und startet dann signalboost.

Er benutzt vier playbooks (die alle im `ansible/playbooks`Verzeichnis zu finden sind):

1. `provision.yml` (erstellt user und System Abhängigkeiten, durchläuft grundlegendes server hardening)
1. `deploy.yml` (baut signalboost docker container, installiert und startet signalboost in ihnen)
1. `harden.yml` (durchläuft speziallisierteres server hardening -- das braucht richtig lange!)

Du kannst alle playbooks mit einem Befehl starten: 

``` shell
cd ansible
ansible-playbook -i inventory playbooks/main.yml
```

*Alternativ:*

In der Standardkonfiguration werden die Geheimnisse welche signalboost benötigt (inklusice IP Adressen und Hostnamen) aus `<PROJECT_ROOT>/.env>` ausgelesen. Solltest du einen anderen Satz Geheimnisse hinterlegen (zum Beispiel für einen staging server) wollen, kannst du den Ort an dem ansible nach der `.env` Datei sucht mit der `env_file` Variabel vorgeben (Das geschieht mit dem setzen der `-e env_file=<ein_pfad>` Flagge). Um Geheimnisse zum Beispiel von `/pfad/zur/staging.env` auszulesen müsstest du den folgenden Befehl nutzen:

``` shell
cd ansible
ansible-playbook -e "env_file=/pfad/zur/staging.env" playbooks/main.yml
```

**(4)Instalation des `boost` CLI Werkzeugs**

Signalboost kommt mit einem cli Werkzeug zum hinzufügen von Telefonnummern, Kanälen und Admins für den Dienst, einher.

Es wird installiert mit:

``` shell
make cli.install
```
Um mehr darüber zu erfahren wie das Befehlszeilenwerkzeug funktioniert kannst du unter [Das Signalboost CLI Tool](#cli) nachschaun

**(6) Provisionierung neuer Twilio Nummern:**

Der folgende Befehl holt zwei neue Nummern mit der US-Ortsvorwahl 510 ein. (Wenn du die `-n` und `-a` Flaggen weglässt holt boost 1 Nummer mit der US-Ortsvorwahl 929.)

``` shell
$ boost new_numbers -n 2 -a 510
```

**(7) Neue signalboost Kanäle provisionieren:**

Davon ausgehend, dass der obige Befehl mit einer Erfolgsmeldung mit der neuen twilio Nummer `+15105555555` ausgeführt wurde, kreiert der unten stehende Befehl einen Kanal mit dem Namen `conquest of bread` auf dieser Nummer, mit den Personen mit den Nummern `+151066666666` and `+15107777777` als Administratoren.

``` shell
$ boost new_channel -p +15105555555 -n "conquest of bread" -a "+151066666666,+15107777777"
```

Mehr vom `boost` CLI Werkzeug unterstützte Befehle kannst du in der [Administrierung](#administering) Sektion weiter unten nachschaun.

**(8) Deployment von signalboost updates**

Bei späterem (re)deployment müssen die `provision`, `configure`, und `harden` playbooks nicht nocheinmal ausgeführt werden. Stattdessen kannst folgendes ausführen:

``` shell
cd ansible
ansible-playbook -i inventory playbooks/deploy.yml
```

## Deployment Anleitung für Team Friendo <a name="deploy-team-friendo)"></a>

Wenn du Teil von `team-friendo` bist, sind hier Anweisungen wie du signalboost provisionierst , deployst und eine existierende Instanz am laufen hälst.

*HINWEIS: Wenn du eine existene signalboost Instanz administrieren willst kannst du die Schritte 3 und 4 weg lassen.*

#### Erstes Deployment

**(1) Geheimnisse laden:**

``` shell
make _.unlock
```

Hinweis: Wir nutzen [blackbox](https://github.com/StackExchange/blackbox) für PGP-basiertes Zugangsmanagment. Es liegt der einfachheit halber in `signalboost/bin/` vor.


**(2) Einen Server erhalten:**


*Hinweis: Wenn du eine existene signalboost Instanz administrieren willst, überspringe diesen Schritt und gehe gleich zu Schritt 5 ! :)*

``` shell
./bin/get-machine
```

**(3) Provisionierung und Deployment von signalboost:**

*Hinweis: Wenn du eine existente signalboost Instanz administrieren willst, überspringe diesen Schritt und gehe gleich zu Schritt 5 ! :)*

``` shell
cd ansible
ansible-playbook -i inventory playbooks/main.yml
```

*Variante 1:* Obiges teilt die Geheimnisse zu indem sie aus `<PROJECT_ROOT>/.env` auf der lokalen Maschine kopiert werden. Wenn sie von einem anderen Ort kopiert werden sollen, kann ein alternativer Pfad an die `env_file` ansible Variabel weitergereicht werden (definiert mit einer `-e env_file=<...>` Flagge). Um zum Beispiel Umgebungsvariabeln aus `/pfad/zu/development.env` zu kopieren, führe folgendes aus 

``` shell
cd ansible
ansible-playbook -i inventory playbooks/main.yml -e env_file /path/to/development.env
```

*Variante 2:*:Um die Geheimnisse zuzuteilen indem eine Kopie von `.env.gpg` unter Versionskontrolle (dadurch warscheinlicher up-to-date), füge die `-e "deploy_method=blackbox"` Flagge hinzu. Zum Beispiel:

``` shell
cd ansible
ansible-playbook -i inventory playbooks/main.yml -e deploy
```

*Anmerkung zum Timing:* Das letzte playbook (`harden.yml`) kann bis zu 2 Stunden brauchen. Nachdem `deploy.yml` durchgelaufen ist. Glücklicherweise kannst du damit beginnen signalboost zu nutzen bevor das fertig ist! Warte nur auf das vollständige Ausführen des `deploy.yml` playbooks (welches mit dem header `Deploy Signalboost` läuft) und fahre dann mit folgenden Schritten fort

**(4) Installation des `boost` cli Werkzeugs:**

Wir haben ein Kommandozeilenwerkzeug zur Durchführung gängiger sysadmin Aufgaben in laufenden signalboost Instanzen. Es kann durch Ausführen des folgenden Befehls installiert werden.

``` shell
make cli.install
```
Um mehr darüber zu erfahren wie das Befehlszeilenwerkzeug funktioniert kannst du unter [Das Signalboost CLI Tool](#cli) nachschaun

**(5) Existente Nummern/Kanäle auflisten:**

Du kannst dir anschaun welche Nummern und Kanäle bereist existieren, mit:

```shell
boost list-numbers
boost list-channels
```

**(6) Provisionierung neuer Twilio Nummern:**

Der folgende Befehl holt zwei neue Nummern mit der US-Ortsvorwahl 510 ein. 

``` shell
boost create-number -n 2 -a 510
```

*HINWEIS: Wenn du die `-n` und `-a` Flaggen weglässt holt boost 1 Nummer mit einer zufälligen Ortsvorwahl.*

**(7) Neue signalboost Kanäle provisionieren:**

Davon ausgehend, dass der obige Befehl mit einer Erfolgsmeldung mit der neuen twilio Nummer `+491701234567` ausgeführt wurde, kreiert der unten stehende Befehl einen Kanal mit dem Namen `conquest of bread` auf dieser Nummer, mit den Nummern `+491702345678` and `+491703456789` als Administratoren.

``` shell
boost create-channel -p +491701234567 -n "Die Eroberung des Brotes" -a "+491702345678,+491703456789"
```

Mehr vom `boost` CLI Werkzeug unterstützte Befehle kannst du in der [Administrierung](#administering) Sektion weiter unten nachschaun.

**(8)Deployment von signalboost updates**

Bei späterem (re)deployment müssen die `provision`, `configure`, und `harden` playbooks nicht nocheinmal ausgeführt werden. Stattdessen kannst folgendes ausführen:

``` shell
cd ansible
ansible-playbook -i inventory playbooks/deploy.yml
```

Wenn du einen einfacheren Weg dies zu tun bevorzugst (und es für dich akzeptabel ist, dass das Verzeichnis für `env_file` auf `<PROJECT_ROOT>/.env` gesetzt ist und `secrets_mode` auf `copy` gestellt ist) kannst du einfach folgendes ausführen:

``` shell
cd <PROJECT_ROOT>
make _.deploy
```
