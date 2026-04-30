# Portail Client Toulemonde Production — Documentation Fonctionnelle Complète (RAG Ready)

## Objectif du document

Ce document décrit le fonctionnement complet du portail client Toulemonde Production afin d'alimenter un système RAG (Retrieval Augmented Generation). Il est destiné :

* aux utilisateurs clients
* aux équipes Toulemonde
* aux équipes IT
* aux agents IA
* aux intégrateurs ERP

Il couvre :

* architecture globale
* parcours client industriel
* parcours client mercerie
* workflow validation interne
* synchronisation ERP Sage
* gestion documents
* gestion statuts
* logique catalogue
* logique commandes techniques

---

# Vue globale de la plateforme

Le portail Toulemonde Production est une plateforme digitale permettant :

1. la création de demandes techniques de fil industriel
2. la commande d'articles standards de mercerie
3. le suivi des commandes
4. la consultation des documents
5. la communication client ↔ Toulemonde

Deux parcours distincts existent :

## Parcours 1

Commande industrielle (sur mesure)

## Parcours 2

Commande mercerie (catalogue standard)

Ces deux parcours sont volontairement séparés car :

* les logiques métiers sont différentes
* les workflows internes sont différents
* les validations sont différentes
* l'intégration ERP est différente

Cependant :

Toutes les commandes sont visibles dans une seule interface :

"Mes commandes"

---

# Architecture technique simplifiée

Frontend :

React

Backend :

Node.js Express

Base de données portail :

PostgreSQL

ERP :

Sage (serveur local entreprise)

Connecteur ERP :

Agent Léon local

Flux :

Client → Portail → Base portail → Agent Léon → Sage

Retour :

Sage → Agent Léon → Portail

---

# Navigation principale côté client

Accueil
Nouvelle demande
Mes commandes
Documents
Profil
Contact

---

# Page Nouvelle demande

La page "Nouvelle demande" est le point d'entrée principal pour créer une commande.

Deux choix sont proposés :

1. Demande industrielle
2. Mercerie

---

# Parcours commande industrielle

## Objectif

Créer une demande technique de fabrication de fil sur mesure.

Ce type de commande permet :

configuration personnalisée
multi‑lignes
validation Toulemonde
intégration ERP
planification production

---

# Étape 1 — Informations générales

Le client renseigne :

référence client
commentaire
urgence
livraison partielle autorisée

Ces informations s'appliquent à toute la demande.

---

# Étape 2 — Lignes de demande

Chaque demande industrielle peut contenir plusieurs lignes.

Chaque ligne correspond à :

une configuration technique de fil

Exemples paramètres :

matière
Nm
retordage
couleur
teinture
référence couleur
quantité
conditionnement
usage

Chaque ligne est indépendante.

Le client peut :

ajouter ligne
modifier ligne
supprimer ligne

---

# Étape 3 — Validation

Avant envoi :

résumé global affiché
résumé par ligne disponible
édition possible

Après validation :

statut = submitted

---

# Workflow interne Toulemonde

Après soumission :

commande reçue
analyse technique
validation interne

Statuts possibles :

submitted
pending_validation
approved
rejected
pending_sage_sync
sent_to_sage
in_production
ready
delivered
cancelled

---

# Validation interne Toulemonde

La validation vérifie :

faisabilité technique
matière disponible
cohérence configuration
quantité compatible
charge production

Résultat :

validation
refus
modification demandée

---

# Passage en production

Une fois validée :

commande envoyée vers ERP
création ordre fabrication
planification production

Statut :

in_production

---

# Suivi production

Le client peut suivre :

validation
production
préparation
livraison

---

# Livraison

Statuts possibles :

ready
expédiée
delivered

---

# Parcours commande mercerie

## Objectif

Commander des articles standards disponibles catalogue.

Contrairement au parcours industriel :

pas de configuration technique
pas de validation complexe
processus rapide

---

# Catalogue mercerie

Le catalogue contient :

catégories
produits
images
références
quantités
prix (optionnel)

Exemples catégories :

Aiguilles
Boutons
Rubans
Fermetures
Fils couture
Accessoires

---

# Ajout au panier

Le client peut :

choisir quantité
ajouter au panier
modifier panier
supprimer ligne panier

---

# Validation commande mercerie

Après validation :

commande enregistrée
statut = submitted

Puis :

confirmed
preparing
ready
delivered

---

# Page Mes commandes

Affiche :

commandes industrielles
commandes mercerie

Filtres :

Toutes
Industrielles
Mercerie

Chaque commande affiche :

numéro
statut
type
référence client
lignes
quantité
montant si catalogue

---

# Documents disponibles

Le client peut consulter :

bons de commande
bons fabrication
bons livraison
factures

Ces documents proviennent :

portail
ERP Sage

---

# Synchronisation ERP Sage

Une fois validée :

commande envoyée vers Sage

Création :

F_DOCENTETE
F_DOCLIGNE
F_COMPTET

Retour ERP :

numéro commande
statut production
statut livraison
factures

---

# Agent Léon

Agent local installé sur réseau Toulemonde.

Fonctions :

lecture portail
écriture Sage
lecture Sage
retour portail

Fréquence sync :

60 secondes

---

# Sécurité architecture

Le portail cloud ne se connecte jamais directement à Sage.

Flux :

Agent local uniquement

---

# Gestion profil client

Le client peut modifier :

adresse facturation
adresse livraison
contact principal
email
TVA

Synchronisation :

visible côté admin

---

# Dashboard client

Affiche :

commandes récentes
brouillons
statuts
notifications

---

# Workflow résumé global

Client crée commande

→ statut submitted

Validation Toulemonde

→ statut approved

Envoi ERP

→ statut sent_to_sage

Production

→ statut in_production

Préparation

→ statut ready

Livraison

→ statut delivered

---

# Objectif plateforme

Créer une interface digitale textile industrielle connectée ERP permettant :

centralisation commandes
réduction emails
réduction erreurs
suivi production
amélioration communication client
expérience moderne B2B textile

---

Fin du document RAG
